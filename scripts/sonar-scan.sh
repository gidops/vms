#!/usr/bin/env bash
# One-command local SonarQube scan (docs/sonarqube-local.md).
#
#   npm run sonar            # start server if needed, scan, print dashboard URL
#   npm run sonar:coverage   # same, but runs backend jest coverage first
#
# Starts the compose `sonar` profile, waits for the server, bootstraps
# credentials on first run (rotates the forced admin/admin password, issues a
# scanner token) into the gitignored .sonar/ dir, then runs the containerized
# scanner. Idempotent: safe to re-run at any point.
set -euo pipefail

cd "$(dirname "$0")/.."

API="http://localhost:9000"
STATE_DIR=".sonar"
TOKEN_FILE="$STATE_DIR/token"
PASS_FILE="$STATE_DIR/admin_password"
TOKEN_NAME="vms-local-scanner"
PROJECT_KEY="gidops_vms"
BOOT_TIMEOUT_S=300

log() { echo "[sonar] $*"; }
die() {
  echo "[sonar] ERROR: $*" >&2
  exit 1
}

reset_help="local SonarQube state is unrecoverable; reset it with:
  docker compose --profile sonar down
  docker volume rm vms_sonarqube_data
  docker compose exec postgres psql -U vms -d vms -c 'DROP DATABASE sonar'
  rm -rf $STATE_DIR
then re-run: npm run sonar"

# ---- [0] Preflight -----------------------------------------------------------
docker info >/dev/null 2>&1 || die "Docker daemon is not running. Start Docker Desktop and retry."

if [ ! -f apps/backend/coverage/lcov.info ]; then
  log "note: no backend coverage found (apps/backend/coverage/lcov.info);"
  log "      run 'npm run sonar:coverage' to include coverage in the analysis."
fi

if [ "$(sysctl -n vm.max_map_count 2>/dev/null || echo 0)" -lt 262144 ]; then
  log "note: vm.max_map_count < 262144. Elasticsearch bootstrap checks are"
  log "      disabled for local use, but if SonarQube proves unstable run:"
  log "      sudo sysctl -w vm.max_map_count=262144"
fi

# ---- [1] Start the server (no-op if already healthy) --------------------------
log "starting SonarQube (first boot takes 1-3 min)..."
docker compose --profile sonar up -d --wait sonarqube ||
  die "SonarQube failed to become healthy; inspect with: docker compose --profile sonar logs sonarqube"

# ---- [2] Wait for the API; handle post-upgrade DB migrations ------------------
deadline=$((SECONDS + BOOT_TIMEOUT_S))
while :; do
  status=$(curl -fsS "$API/api/system/status" 2>/dev/null |
    sed -n 's/.*"status":"\([A-Z_]*\)".*/\1/p' || true)
  case "$status" in
  UP) break ;;
  DB_MIGRATION_NEEDED)
    log "image upgraded; running database migration..."
    curl -fsS -X POST "$API/api/system/migrate_db" >/dev/null || true
    ;;
  *) : ;; # STARTING / DB_MIGRATION_RUNNING / empty — keep waiting
  esac
  [ "$SECONDS" -lt "$deadline" ] || die "server not UP after ${BOOT_TIMEOUT_S}s (last status: ${status:-unreachable})"
  sleep 5
done
log "server is up."

# ---- [3] Auth bootstrap (idempotent) ------------------------------------------
mkdir -p "$STATE_DIR" && chmod 700 "$STATE_DIR"

token_valid() {
  [ -f "$TOKEN_FILE" ] &&
    curl -fsS -u "$(cat "$TOKEN_FILE"):" "$API/api/user_tokens/search" >/dev/null 2>&1
}

admin_auth_ok() {
  curl -fsS -u "admin:$1" "$API/api/user_tokens/search" >/dev/null 2>&1
}

if ! token_valid; then
  log "no valid scanner token; bootstrapping credentials..."
  if [ -f "$PASS_FILE" ] && admin_auth_ok "$(cat "$PASS_FILE")"; then
    pass=$(cat "$PASS_FILE")
  elif admin_auth_ok admin; then
    # Fresh instance: rotate the forced default admin/admin password. The
    # "Vms!" prefix satisfies the server's password policy (≥12 chars with
    # upper/lower/digit/special), which raw hex output would fail.
    pass="Vms!$(openssl rand -hex 16)"
    curl -fsS -X POST -u admin:admin "$API/api/users/change_password" \
      -d "login=admin&previousPassword=admin&password=$pass" >/dev/null ||
      die "could not change the default admin password; $reset_help"
    (umask 177 && echo "$pass" >"$PASS_FILE")
    log "admin password rotated (saved to $PASS_FILE)."
  else
    die "admin credentials unknown — $reset_help"
  fi

  # Revoke-then-generate so re-runs never hit "token name already exists".
  curl -fsS -X POST -u "admin:$pass" "$API/api/user_tokens/revoke" \
    -d "name=$TOKEN_NAME" >/dev/null 2>&1 || true
  token=$(curl -fsS -X POST -u "admin:$pass" "$API/api/user_tokens/generate" \
    -d "name=$TOKEN_NAME" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  [ -n "$token" ] || die "token generation failed; $reset_help"
  (umask 177 && echo "$token" >"$TOKEN_FILE")
  log "scanner token issued (saved to $TOKEN_FILE)."
fi

# ---- [4] Scan ------------------------------------------------------------------
log "running scanner (config: sonar-project.properties)..."
SONAR_TOKEN="$(cat "$TOKEN_FILE")" docker compose --profile sonar run --rm sonar-scanner

# ---- [5] Report ----------------------------------------------------------------
log "done."
log "dashboard: $API/dashboard?id=$PROJECT_KEY"
[ -f "$PASS_FILE" ] && log "login:     admin / $(cat "$PASS_FILE")"
