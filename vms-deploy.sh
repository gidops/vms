#!/usr/bin/env bash
#
# vms-deploy.sh — deploy the VMS monorepo to AWS via prebuilt ECR images,
# tagged by git short SHA (NOT :latest), with PER-APP image tags.
#
# Why per-app tags:
#   Terraform has two variables (no defaults), each interpolated into one
#   instance's user_data:
#       var.backend_image_tag  -> backend  `docker run ...:<tag>`
#       var.frontend_image_tag -> frontend `docker run ...:<tag>`
#   The tag is part of the instance configuration:
#     - Change an app's tag -> its user_data changes -> `terraform apply`
#       REPLACES only that instance (re-runs user_data, pulls the new image).
#     - Same tag -> no diff -> no-op for that instance.
#
#   Crucially, deploying ONE app must NOT disturb the other. So every apply
#   passes BOTH tag vars: $TAG for the app(s) being deployed, and the OTHER
#   app's CURRENT deployed tag (read from `terraform output`) for the rest.
#   That keeps the untouched app pinned to the image it's already running.
#
# Modes:
#   --deploy [backend|frontend|both]   (default: both)
#       Build + push the named image(s) at $TAG, then apply with both tag vars
#       (deployed app -> $TAG, other app -> its current tag). Handles first-time
#       creation AND updates — no -replace. Also bootstraps Phase A if needed.
#
#   --redeploy [backend|frontend|both] (default: both)
#       NO build. Recreate the named instance(s) with -replace, passing BOTH
#       current tags UNCHANGED. This is the only mode that needs -replace: tags
#       don't change, so Terraform would otherwise see no diff and refuse to
#       touch a crash-looping box.
#
# NOTE — Phase A ordering: the ECR repos and the backend EIP must exist BEFORE
# any image can be built/pushed (the frontend bakes the EIP in at build time,
# and you can't push to a repo that doesn't exist). On a destroyed stack the
# registry/EIP outputs are empty, so --deploy first runs a targeted apply:
#   terraform apply -var="backend_image_tag=$TAG" -var="frontend_image_tag=$TAG" \
#     -target=aws_ecr_repository.backend -target=aws_ecr_repository.frontend \
#     -target=aws_eip.backend
# then re-reads the outputs and continues. (Both tag vars are required even for
# a targeted apply; the images get built right after.)
#
# FRESH-STACK RULE: on a truly fresh stack there are no current tags, so an app
# you are NOT building would have no image to pin to. --deploy therefore REQUIRES
# "both" when no current tags exist (single-app deploy is refused).
#
# Examples:
#   ./vms-deploy.sh --deploy            # build+push both @ SHA, apply
#   ./vms-deploy.sh --deploy backend    # roll only backend; frontend stays put
#   ./vms-deploy.sh --redeploy frontend # recreate a broken box, no rebuild
#
# Run from the repo root (where ./terraform lives). Nothing is hardcoded — repo
# URLs, registry host, EIP, and current tags are all read from `terraform output`.

set -euo pipefail

REGION="us-east-1"
TF="terraform -chdir=terraform"

# ---------- helpers ----------

die() { echo "ERROR: $*" >&2; exit 1; }

usage() {
  cat >&2 <<EOF
Usage:
  $0 --deploy   [backend|frontend|both]   (default: both)
  $0 --redeploy [backend|frontend|both]   (default: both)
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

# Populate registry/repo/EIP vars + the currently-deployed per-app tags.
# Empties are allowed (Phase A not applied yet / first ever deploy).
read_outputs() {
  BACKEND_REPO="$(tf_out ecr_backend_repository_url)"
  FRONTEND_REPO="$(tf_out ecr_frontend_repository_url)"
  BACKEND_EIP="$(tf_out backend_eip)"
  CURRENT_BACKEND="$(tf_out backend_image_tag)"
  CURRENT_FRONTEND="$(tf_out frontend_image_tag)"
  REGISTRY="${BACKEND_REPO%/*}" # strip trailing /vms-backend to get the registry host
}

# Same, but hard-fail if anything is missing (used where the stack must be up).
require_outputs() {
  read_outputs
  [ -n "$BACKEND_REPO" ] || die "ecr_backend_repository_url missing. Is the stack applied?"
  [ -n "$FRONTEND_REPO" ] || die "ecr_frontend_repository_url missing."
  [ -n "$BACKEND_EIP" ] || die "backend_eip missing. Is the EIP allocated?"
}

# Create ONLY the ECR repos + EIP, so images can be pushed and the EIP baked in.
# Lets --deploy work from a fully destroyed state. Both tag vars are required.
bootstrap_phase_a() {
  echo "=== Phase A: ECR repos + EIP not found — creating them first ==="
  $TF apply \
    -var="backend_image_tag=$TAG" \
    -var="frontend_image_tag=$TAG" \
    -target=aws_ecr_repository.backend \
    -target=aws_ecr_repository.frontend \
    -target=aws_eip.backend
  read_outputs
  [ -n "$BACKEND_REPO" ] || die "ecr_backend_repository_url still missing after Phase A."
  [ -n "$FRONTEND_REPO" ] || die "ecr_frontend_repository_url still missing after Phase A."
  [ -n "$BACKEND_EIP" ] || die "backend_eip still missing after Phase A."
  echo "=== Phase A done. Backend EIP = $BACKEND_EIP ==="
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
  echo "=== Building + pushing FRONTEND @ $TAG (EIP $BACKEND_EIP baked in) ==="
  docker build -f apps/frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_API_BASE_URL="http://$BACKEND_EIP:4000" \
    -t "$FRONTEND_REPO:$TAG" .
  docker push "$FRONTEND_REPO:$TAG"
  verify_frontend_bake
}

# Hard-fail if the EIP did not get inlined into the frontend bundle — this is the
# single highest-risk silent failure (browser ends up calling a dead address).
verify_frontend_bake() {
  echo "--- Verifying $BACKEND_EIP is baked into the frontend bundle ---"
  docker run --rm --entrypoint node "$FRONTEND_REPO:$TAG" -e "
    const cp = require('child_process');
    const hit = cp.execSync('grep -rl ${BACKEND_EIP} /app 2>/dev/null || true').toString().trim();
    if (!hit) { console.error('  NOT FOUND'); process.exit(1); }
    console.log('  OK: ' + hit.split('\n')[0]);
  " || die "EIP $BACKEND_EIP not found in frontend bundle — build-arg did not take. Stopping before deploy."
}

# Pause so a human reads the plan before any apply that could touch the EIP or RDS.
confirm_plan() {
  echo
  echo ">>> Review the plan above carefully:"
  echo "    - It should create/replace ONLY the instance(s) you intend (+ aws_eip_association.backend)."
  echo "    - It must NOT show aws_eip.backend being destroyed/replaced (that drifts your address)."
  echo "    - It must NOT show aws_db_instance.main (RDS) — that would drop your tables."
  # CI/CD (Jenkins) runs non-interactively: there is no TTY to read from, so the
  # human review above is gated upstream (a Jenkins `input` approval step). Set
  # VMS_AUTO_APPROVE=1 to skip the blocking prompt.
  if [ "${VMS_AUTO_APPROVE:-0}" = "1" ]; then
    echo ">>> VMS_AUTO_APPROVE=1 — skipping interactive confirmation (non-interactive run)."
    return 0
  fi
  read -r -p ">>> Press Enter to apply, or Ctrl-C to abort. "
}

# After an apply, confirm the EIP held; if not, the frontend bake is now stale.
check_eip_held() {
  local before="$1"
  local after
  after="$(tf_out backend_eip)"
  echo
  if [ "$after" = "$before" ]; then
    echo "=== EIP held: $after (frontend bake still valid) ==="
  else
    echo "!!! EIP CHANGED: was $before, now $after"
    echo "!!! The frontend image is now baked with a STALE address."
    echo "!!! Re-run: $0 --deploy frontend"
  fi
}

# ---------- modes ----------

do_deploy() {
  local target="$1"
  echo "########## DEPLOY: $target (build + push @ $TAG, then apply) ##########"

  read_outputs
  if [ -z "$BACKEND_REPO" ] || [ -z "$FRONTEND_REPO" ] || [ -z "$BACKEND_EIP" ]; then
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

  local eip_before="$BACKEND_EIP"
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
  echo ">>> Only the app(s) whose tag changed get replaced; the other stays pinned."
  $TF plan -var="backend_image_tag=$backend_tag" -var="frontend_image_tag=$frontend_tag"
  confirm_plan
  $TF apply -var="backend_image_tag=$backend_tag" -var="frontend_image_tag=$frontend_tag"

  check_eip_held "$eip_before"
  echo
  echo "=== Deploy complete. Current addresses: ==="
  $TF output
}

do_redeploy() {
  local target="$1"
  echo "########## REDEPLOY: $target (replace only, NO rebuild) ##########"
  require_outputs
  [ -n "$CURRENT_BACKEND" ] || die "No current backend_image_tag to pass through. Is the stack deployed?"
  [ -n "$CURRENT_FRONTEND" ] || die "No current frontend_image_tag to pass through. Is the stack deployed?"
  local eip_before="$BACKEND_EIP"

  local replace_args=()
  case "$target" in
    backend) replace_args=(-replace=aws_instance.backend) ;;
    frontend) replace_args=(-replace=aws_instance.frontend) ;;
    both) replace_args=(-replace=aws_instance.backend -replace=aws_instance.frontend) ;;
  esac

  echo "=== Replacing instance(s) — no rebuild; both tags unchanged ==="
  echo "    backend_image_tag=$CURRENT_BACKEND frontend_image_tag=$CURRENT_FRONTEND"
  echo "    (Use this to recover a crash-looping box when the image hasn't changed.)"
  $TF plan -var="backend_image_tag=$CURRENT_BACKEND" -var="frontend_image_tag=$CURRENT_FRONTEND" "${replace_args[@]}"
  confirm_plan
  $TF apply -var="backend_image_tag=$CURRENT_BACKEND" -var="frontend_image_tag=$CURRENT_FRONTEND" "${replace_args[@]}"

  check_eip_held "$eip_before"
}

# ---------- entry ----------

[ -d terraform ] || die "No ./terraform directory here. Run from the repo root."

# Initialize the S3 backend BEFORE any terraform command. The app stack uses a
# remote S3 backend, so a fresh Jenkins workspace has no .terraform/ and every
# `terraform output/plan/apply` — including the Phase A bootstrap below — would
# fail with "Backend initialization required, please run terraform init".
# Plain init suffices (no local state to migrate; the S3 backend auto-configures);
# -input=false so it never blocks on a prompt in non-interactive CI.
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
    [ $# -le 2 ] || usage
    target="${2:-both}"
    valid_target "$target" || usage
    do_redeploy "$target"
    ;;
  *) usage ;;
esac
