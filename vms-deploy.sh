#!/usr/bin/env bash
#
# vms-deploy.sh — deploy the VMS monorepo to AWS via prebuilt ECR images,
# tagged by git short SHA (NOT :latest), with PER-APP image tags.
#
# TARGET ENVIRONMENT: the Platta Integrated non-prod account (Identity Center
# SSO profile `platta-nonprod` by default — override with AWS_PROFILE). The
# stack is a SINGLE private Docker host running both containers behind an ALB:
#   frontend  http://<alb-dns>/        (ALB :80  → host :80,  container :3000)
#   backend   http://<alb-dns>:8080/   (ALB :8080 → host :4000)
#
# Why per-app tags:
#   Terraform has two variables (no defaults), both interpolated into the app
#   host's user_data:
#       var.backend_image_tag  -> `docker run ...backend:<tag>`
#       var.frontend_image_tag -> `docker run ...frontend:<tag>`
#   The tags are part of the instance configuration:
#     - Change either tag -> user_data changes -> `terraform apply` REPLACES
#       the host (re-runs user_data, pulls the new image(s)).
#     - Same tags -> no diff -> no-op.
#   NOTE: with a single host, deploying EITHER app replaces the shared host,
#   so both containers restart (brief downtime — acceptable in dev). Passing
#   the untouched app's CURRENT tag keeps IT pinned to the image it already
#   runs; only the app you're deploying changes version.
#
# Modes:
#   --deploy [backend|frontend|both]   (default: both)
#       Build + push the named image(s) at $TAG, then apply with both tag vars
#       (deployed app -> $TAG, other app -> its current tag). Handles first-time
#       creation AND updates — no -replace. Also bootstraps Phase A if needed.
#
#   --redeploy                          (no target needed — one host)
#       NO build. Recreate the app host with -replace, passing BOTH current
#       tags UNCHANGED. Use to recover a crash-looping box when the images
#       haven't changed (tags identical -> terraform would otherwise see no
#       diff and refuse to touch it).
#
# NOTE — Phase A ordering: the ECR repos and the ALB must exist BEFORE any
# image can be built/pushed (the frontend bakes the ALB's DNS name into
# NEXT_PUBLIC_API_BASE_URL at build time, and you can't push to a repo that
# doesn't exist). On a fresh stack the outputs are empty, so --deploy first
# runs a targeted apply:
#   terraform apply -var=... -target=aws_ecr_repository.backend \
#     -target=aws_ecr_repository.frontend -target=aws_lb.main
# (the ALB target pulls in the VPC/subnets/SGs it depends on), then re-reads
# the outputs and continues. Both tag vars are required even for a targeted
# apply; the images get built right after.
#
# FRESH-STACK RULE: on a truly fresh stack there are no current tags, so an app
# you are NOT building would have no image to pin to. --deploy therefore REQUIRES
# "both" when no current tags exist (single-app deploy is refused).
#
# Examples:
#   ./vms-deploy.sh --deploy            # build+push both @ SHA, apply
#   ./vms-deploy.sh --deploy backend    # roll only backend; frontend stays pinned
#   ./vms-deploy.sh --redeploy          # recreate the host, no rebuild
#
# Run from the repo root (where ./terraform lives). Nothing is hardcoded — repo
# URLs, ALB DNS and current tags are all read from `terraform output`.

set -euo pipefail

REGION="us-east-1"
TF="terraform -chdir=terraform"

# Identity Center SSO profile for the Platta non-prod account. Everything —
# terraform (via var.aws_profile default), the ECR login below — uses it.
# If the session has expired: aws sso login --profile platta-nonprod
export AWS_PROFILE="${AWS_PROFILE:-platta-nonprod}"

# Frontend API base URL baked into the Next.js bundle at build time. There is
# no corporate domain yet, so the default is derived from the ALB's DNS name
# (read from terraform output in read_outputs) on port 8080. Override with
# VMS_API_BASE_URL once a real domain exists (e.g. https://api.<domain>).
API_BASE_URL="${VMS_API_BASE_URL:-}"

# Approval flags applied to EVERY `terraform apply`. In CI there is no TTY, so
# terraform's own "Do you want to perform these actions?" prompt hits stdin EOF
# and dies — the human approval already happened at the upstream gate. When
# VMS_AUTO_APPROVE=1, run every apply with -auto-approve -input=false. Left
# empty otherwise so local, interactive runs still get terraform's normal
# confirmation prompt.
APPLY_FLAGS=()
if [ "${VMS_AUTO_APPROVE:-0}" = "1" ]; then
  APPLY_FLAGS=(-input=false -auto-approve)
fi

# ---------- helpers ----------

die() { echo "ERROR: $*" >&2; exit 1; }

usage() {
  cat >&2 <<EOF
Usage:
  $0 --deploy   [backend|frontend|both]   (default: both)
  $0 --redeploy                            (replace the app host, no rebuild)
EOF
  exit 1
}

valid_target() {
  case "$1" in
    backend | frontend | both) return 0 ;;
    *) return 1 ;;
  esac
}

# Read a terraform output, empty string if absent (don't let set -e kill us).
# Two failure modes to absorb, both must yield "":
#   1. Outputs exist but NAME doesn't -> error on stderr, exit 1 (|| return 0).
#   2. State has NO outputs at all -> terraform prints a "No outputs found"
#      warning to STDOUT and exits 0, so 2>/dev/null + exit check miss it;
#      detect the warning text (-no-color keeps it greppable) and treat as empty.
tf_out() {
  local val
  val="$($TF output -no-color -raw "$1" 2>/dev/null)" || return 0
  case "$val" in
    *"No outputs found"*) return 0 ;;
  esac
  printf '%s' "$val"
}

# Populate registry/repo/ALB vars + the currently-deployed per-app tags.
# Empties are allowed (Phase A not applied yet / first ever deploy).
read_outputs() {
  BACKEND_REPO="$(tf_out ecr_backend_repository_url)"
  FRONTEND_REPO="$(tf_out ecr_frontend_repository_url)"
  ALB_DNS="$(tf_out alb_dns_name)"
  CURRENT_BACKEND="$(tf_out backend_image_tag)"
  CURRENT_FRONTEND="$(tf_out frontend_image_tag)"
  REGISTRY="${BACKEND_REPO%/*}" # strip trailing /vms-backend to get the registry host
  # Resolve the frontend's API base URL now that the ALB DNS is known.
  if [ -z "$API_BASE_URL" ] && [ -n "$ALB_DNS" ]; then
    API_BASE_URL="http://$ALB_DNS:8080"
  fi
}

# Same, but hard-fail if anything is missing (used where the stack must be up).
require_outputs() {
  read_outputs
  [ -n "$BACKEND_REPO" ] || die "ecr_backend_repository_url missing. Is the stack applied?"
  [ -n "$FRONTEND_REPO" ] || die "ecr_frontend_repository_url missing."
  [ -n "$ALB_DNS" ] || die "alb_dns_name missing. Is the ALB created?"
}

# Create ONLY the ECR repos + the ALB (and its network dependencies), so images
# can be pushed and the ALB DNS baked into the frontend. Lets --deploy work
# from a fully destroyed state. Both tag vars are required.
bootstrap_phase_a() {
  echo "=== Phase A: ECR repos + ALB not found — creating them first ==="
  $TF apply "${APPLY_FLAGS[@]}" \
    -var="backend_image_tag=$TAG" \
    -var="frontend_image_tag=$TAG" \
    -target=aws_ecr_repository.backend \
    -target=aws_ecr_repository.frontend \
    -target=aws_internet_gateway.main \
    -target=aws_lb.main
  read_outputs
  [ -n "$BACKEND_REPO" ] || die "ecr_backend_repository_url still missing after Phase A."
  [ -n "$FRONTEND_REPO" ] || die "ecr_frontend_repository_url still missing after Phase A."
  [ -n "$ALB_DNS" ] || die "alb_dns_name still missing after Phase A."
  echo "=== Phase A done. ALB DNS = $ALB_DNS ==="
}

ecr_login() {
  echo "=== Logging in to ECR ($REGISTRY) ==="
  aws ecr get-login-password --region "$REGION" \
    | docker login --username AWS --password-stdin "$REGISTRY"
}

build_push_backend() {
  echo "=== Building + pushing BACKEND @ $TAG ==="
  docker build -f apps/backend/Dockerfile -t "$BACKEND_REPO:$TAG" .
  docker push "$BACKEND_REPO:$TAG"
}

build_push_frontend() {
  echo "=== Building + pushing FRONTEND @ $TAG ($API_BASE_URL baked in) ==="
  docker build -f apps/frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" \
    -t "$FRONTEND_REPO:$TAG" .
  docker push "$FRONTEND_REPO:$TAG"
  verify_frontend_bake
}

# Hard-fail if the API base URL did not get inlined into the frontend bundle —
# this is the single highest-risk silent failure (browser ends up calling a dead
# address). grep -F: the URL contains "/" and ":", so match it as a fixed string.
verify_frontend_bake() {
  echo "--- Verifying $API_BASE_URL is baked into the frontend bundle ---"
  docker run --rm --entrypoint node "$FRONTEND_REPO:$TAG" -e "
    const cp = require('child_process');
    const hit = cp.execSync('grep -rlF \"${API_BASE_URL}\" /app 2>/dev/null || true').toString().trim();
    if (!hit) { console.error('  NOT FOUND'); process.exit(1); }
    console.log('  OK: ' + hit.split('\n')[0]);
  " || die "API base URL $API_BASE_URL not found in frontend bundle — build-arg did not take. Stopping before deploy."
}

# Pause so a human reads the plan before any apply that could touch RDS.
confirm_plan() {
  echo
  echo ">>> Review the plan above carefully:"
  echo "    - It should create/replace ONLY aws_instance.app (+ its two target group attachments)."
  echo "    - It must NOT show aws_db_instance.main (RDS) — that would drop your tables."
  echo "    - Replacing the single host restarts BOTH containers (brief dev downtime)."
  # CI/CD runs non-interactively: there is no TTY to read from, so the human
  # review is gated upstream. Set VMS_AUTO_APPROVE=1 to skip the blocking prompt.
  if [ "${VMS_AUTO_APPROVE:-0}" = "1" ]; then
    echo ">>> VMS_AUTO_APPROVE=1 — skipping interactive confirmation (non-interactive run)."
    return 0
  fi
  read -r -p ">>> Press Enter to apply, or Ctrl-C to abort. "
}

# ---------- modes ----------

do_deploy() {
  local target="$1"
  echo "########## DEPLOY: $target (build + push @ $TAG, then apply) ##########"

  read_outputs
  if [ -z "$BACKEND_REPO" ] || [ -z "$FRONTEND_REPO" ] || [ -z "$ALB_DNS" ]; then
    # Fresh/destroyed stack: no current tags exist, so an app we don't build
    # would have nothing to pin to. Require "both".
    [ "$target" = "both" ] || die "Fresh stack (no current tags): --deploy must be 'both', not '$target'."
    bootstrap_phase_a
  fi

  # Resolve the tag each app will be applied with: $TAG for what we're deploying,
  # the current deployed tag for the app we're leaving alone.
  local backend_tag frontend_tag
  case "$target" in
    backend)
      backend_tag="$TAG"
      frontend_tag="$CURRENT_FRONTEND"
      [ -n "$frontend_tag" ] || die "No current frontend_image_tag to preserve. Run --deploy both."
      ;;
    frontend)
      frontend_tag="$TAG"
      backend_tag="$CURRENT_BACKEND"
      [ -n "$backend_tag" ] || die "No current backend_image_tag to preserve. Run --deploy both."
      ;;
    both)
      backend_tag="$TAG"
      frontend_tag="$TAG"
      ;;
  esac

  ecr_login
  case "$target" in
    backend) build_push_backend ;;
    frontend) build_push_frontend ;;
    both)
      build_push_backend
      build_push_frontend
      ;;
  esac

  echo "=== Applying: backend_image_tag=$backend_tag frontend_image_tag=$frontend_tag ==="
  echo ">>> A changed tag replaces the (single) app host; unchanged tags stay pinned."
  $TF plan -var="backend_image_tag=$backend_tag" -var="frontend_image_tag=$frontend_tag"
  confirm_plan
  $TF apply "${APPLY_FLAGS[@]}" -var="backend_image_tag=$backend_tag" -var="frontend_image_tag=$frontend_tag"

  echo
  echo "=== Deploy complete. Current addresses: ==="
  $TF output
  echo
  echo "    Frontend: http://$ALB_DNS/"
  echo "    Backend:  http://$ALB_DNS:8080/health"
}

do_redeploy() {
  echo "########## REDEPLOY: replace the app host (NO rebuild) ##########"
  require_outputs
  [ -n "$CURRENT_BACKEND" ] || die "No current backend_image_tag to pass through. Is the stack deployed?"
  [ -n "$CURRENT_FRONTEND" ] || die "No current frontend_image_tag to pass through. Is the stack deployed?"

  echo "=== Replacing the app host — no rebuild; both tags unchanged ==="
  echo "    backend_image_tag=$CURRENT_BACKEND frontend_image_tag=$CURRENT_FRONTEND"
  echo "    (Use this to recover a crash-looping box when the images haven't changed.)"
  $TF plan -var="backend_image_tag=$CURRENT_BACKEND" -var="frontend_image_tag=$CURRENT_FRONTEND" -replace=aws_instance.app
  confirm_plan
  $TF apply "${APPLY_FLAGS[@]}" -var="backend_image_tag=$CURRENT_BACKEND" -var="frontend_image_tag=$CURRENT_FRONTEND" -replace=aws_instance.app
}

# ---------- entry ----------

[ -d terraform ] || die "No ./terraform directory here. Run from the repo root."

# Initialize the S3 backend BEFORE any terraform command. The stack uses a
# remote S3 backend (platta-tfstate-* in the non-prod account), so a fresh
# workspace has no .terraform/ and every `terraform output/plan/apply` —
# including the Phase A bootstrap — would fail with "Backend initialization
# required". Plain init suffices; -input=false so it never blocks on a prompt.
$TF init -input=false

# Tag every image for this run by git short SHA (+ -dirty if the tree is unclean).
TAG="$(git describe --always --dirty)"
case "$TAG" in
  *-dirty)
    echo "WARNING: working tree has uncommitted changes." >&2
    echo "WARNING: image tag '$TAG' is NOT reproducible from git — you won't be" >&2
    echo "WARNING: able to recreate this exact build from a clean checkout. Continuing." >&2
    ;;
esac
echo "=== Image tag for this run: $TAG ==="

case "${1:-}" in
  --deploy)
    [ $# -le 2 ] || usage
    target="${2:-both}"
    valid_target "$target" || usage
    do_deploy "$target"
    ;;
  --redeploy)
    [ $# -le 1 ] || usage
    do_redeploy
    ;;
  *) usage ;;
esac
