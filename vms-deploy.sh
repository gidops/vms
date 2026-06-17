#!/usr/bin/env bash
#
# vms-deploy.sh — deploy the VMS monorepo to AWS via prebuilt ECR images.
#
# Three intents, each mapping cleanly to whether `terraform apply -replace` is needed:
#
#   --fresh                       Stack is destroyed. Phase A (create ECR + EIP) ->
#                                 build/push both images with the new EIP baked in ->
#                                 Phase C (full apply creates everything). No -replace
#                                 (instances are created for the first time).
#
#   --update [backend|frontend|both]
#                                 Stack is up, you changed code. Rebuild/push only the
#                                 changed image(s), then -replace ONLY those instance(s)
#                                 so they re-pull. (-replace is required: pushing a new
#                                 :latest is invisible to Terraform, so a plain apply
#                                 would do nothing.)
#
#   --redeploy [backend|frontend|both]
#                                 Stack is up, image unchanged, but an instance is broken
#                                 / crash-looping and you just want to recreate it.
#                                 -replace with NO rebuild.
#
# Examples:
#   ./vms-deploy.sh --fresh
#   ./vms-deploy.sh --update backend
#   ./vms-deploy.sh --update both
#   ./vms-deploy.sh --redeploy frontend
#
# Run from the repo root (where ./terraform lives). Nothing is hardcoded — repo URLs,
# registry host, and the EIP are all read from `terraform output`.

set -euo pipefail

REGION="us-east-1"
TF="terraform -chdir=terraform"

# ---------- helpers ----------

die() { echo "ERROR: $*" >&2; exit 1; }

usage() {
  cat >&2 <<EOF
Usage:
  $0 --fresh
  $0 --update   [backend|frontend|both]
  $0 --redeploy [backend|frontend|both]
EOF
  exit 1
}

# Read a terraform output, empty string if absent (don't let set -e kill us).
tf_out() { $TF output -raw "$1" 2>/dev/null || true; }

require_outputs() {
  BACKEND_REPO="$(tf_out ecr_backend_repository_url)"
  FRONTEND_REPO="$(tf_out ecr_frontend_repository_url)"
  BACKEND_EIP="$(tf_out backend_eip)"
  [ -n "$BACKEND_REPO" ]  || die "ecr_backend_repository_url missing. Is the stack (at least Phase A) applied?"
  [ -n "$FRONTEND_REPO" ] || die "ecr_frontend_repository_url missing."
  [ -n "$BACKEND_EIP" ]   || die "backend_eip missing. Is the EIP allocated?"
  REGISTRY="${BACKEND_REPO%/*}"   # strip trailing /vms-backend to get the registry host
}

ecr_login() {
  echo "=== Logging in to ECR ($REGISTRY) ==="
  aws ecr get-login-password --region "$REGION" \
    | docker login --username AWS --password-stdin "$REGISTRY"
}

build_push_backend() {
  echo "=== Building + pushing BACKEND ==="
  docker build -f apps/backend/Dockerfile -t "$BACKEND_REPO:latest" .
  docker push "$BACKEND_REPO:latest"
}

build_push_frontend() {
  echo "=== Building + pushing FRONTEND (EIP $BACKEND_EIP baked in) ==="
  docker build -f apps/frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_API_BASE_URL="http://$BACKEND_EIP:4000" \
    -t "$FRONTEND_REPO:latest" .
  docker push "$FRONTEND_REPO:latest"
  verify_frontend_bake
}

# Hard-fail if the EIP did not get inlined into the frontend bundle — this is the
# single highest-risk silent failure (browser ends up calling a dead address).
verify_frontend_bake() {
  echo "--- Verifying $BACKEND_EIP is baked into the frontend bundle ---"
  docker run --rm --entrypoint node "$FRONTEND_REPO:latest" -e "
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
  echo "    - It should replace ONLY the instance(s) you intend (+ aws_eip_association.backend)."
  echo "    - It must NOT show aws_eip.backend being destroyed/replaced (that drifts your address)."
  echo "    - It must NOT show aws_db_instance.main (RDS) — that would drop your tables."
  read -r -p ">>> Press Enter to apply, or Ctrl-C to abort. "
}

# After an instance replace, confirm the EIP held; if not, the frontend is now stale.
check_eip_held() {
  local before="$1"
  local after; after="$(tf_out backend_eip)"
  echo
  if [ "$after" = "$before" ]; then
    echo "=== EIP held: $after (frontend bake still valid) ==="
  else
    echo "!!! EIP CHANGED: was $before, now $after"
    echo "!!! The frontend image is now baked with a STALE address."
    echo "!!! Re-run: $0 --update frontend"
  fi
}

# ---------- intents ----------

do_fresh() {
  echo "########## FRESH DEPLOY (from destroyed state) ##########"
  echo "=== Phase A: create ECR repos + EIP only ==="
  $TF apply \
    -target=aws_ecr_repository.backend \
    -target=aws_ecr_repository.frontend \
    -target=aws_eip.backend

  require_outputs
  echo "=== Phase A done. Backend EIP = $BACKEND_EIP ==="

  ecr_login
  build_push_backend
  build_push_frontend   # builds with the brand-new EIP, verifies bake

  echo "=== Phase C: apply the full stack (creates instances, which pull the images) ==="
  echo ">>> Plan should be all CREATES, no destroy/replace."
  confirm_plan
  $TF apply

  echo
  echo "=== Fresh deploy complete. Current addresses: ==="
  $TF output
}

do_update() {
  local target="$1"
  echo "########## UPDATE: $target (rebuild + push + replace) ##########"
  require_outputs
  local eip_before="$BACKEND_EIP"
  ecr_login

  local replace_args=()
  case "$target" in
    backend)  build_push_backend;  replace_args=(-replace=aws_instance.backend) ;;
    frontend) build_push_frontend; replace_args=(-replace=aws_instance.frontend) ;;
    both)     build_push_backend; build_push_frontend
              replace_args=(-replace=aws_instance.backend -replace=aws_instance.frontend) ;;
    *) usage ;;
  esac

  echo "=== Rolling instance(s) so they pull the new image(s) ==="
  $TF plan "${replace_args[@]}"
  confirm_plan
  $TF apply "${replace_args[@]}"

  check_eip_held "$eip_before"
}

do_redeploy() {
  local target="$1"
  echo "########## REDEPLOY: $target (replace only, NO rebuild) ##########"
  require_outputs
  local eip_before="$BACKEND_EIP"

  local replace_args=()
  case "$target" in
    backend)  replace_args=(-replace=aws_instance.backend) ;;
    frontend) replace_args=(-replace=aws_instance.frontend) ;;
    both)     replace_args=(-replace=aws_instance.backend -replace=aws_instance.frontend) ;;
    *) usage ;;
  esac

  echo "=== Replacing instance(s) — no image rebuild (recovers a crash-looping box) ==="
  $TF plan "${replace_args[@]}"
  confirm_plan
  $TF apply "${replace_args[@]}"

  check_eip_held "$eip_before"
}

# ---------- entry ----------

[ -d terraform ] || die "No ./terraform directory here. Run from the repo root."

case "${1:-}" in
  --fresh)
    [ $# -eq 1 ] || usage
    do_fresh ;;
  --update)
    [ $# -eq 2 ] || usage
    do_update "$2" ;;
  --redeploy)
    [ $# -eq 2 ] || usage
    do_redeploy "$2" ;;
  *) usage ;;
esac
