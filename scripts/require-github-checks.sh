#!/usr/bin/env bash
# Fails unless every required GitHub Actions job passed on the given commit.
# Jenkins runs this before deploying, so only code that passed CI ships.
#
# Usage: GITHUB_TOKEN=... scripts/require-github-checks.sh <commit-sha>
# The token needs read access to the repo's checks (fine-grained PAT: "Checks: Read").
set -euo pipefail

SHA="${1:?commit sha required}"
REPO="${GITHUB_REPO:-gidops/vms}"
REQUIRED=("Apps (lint + typecheck + build)" "Terraform (fmt + validate)")

json="$(curl -fsSL \
  -H "Authorization: Bearer ${GITHUB_TOKEN:?GITHUB_TOKEN required}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO}/commits/${SHA}/check-runs?per_page=100")"

failed=0
for name in "${REQUIRED[@]}"; do
  result="$(printf '%s' "$json" | python3 -c '
import json, sys
name = sys.argv[1]
runs = [r for r in json.load(sys.stdin)["check_runs"] if r["name"] == name]
if not runs:
    print("missing")
else:
    latest = max(runs, key=lambda r: r["started_at"] or "")
    print(latest["conclusion"] or latest["status"])
' "$name")"
  echo "${name}: ${result}"
  [[ "$result" == "success" ]] || failed=1
done

if [[ "$failed" -ne 0 ]]; then
  echo "GitHub Actions has not passed on ${SHA}; refusing to deploy." >&2
  exit 1
fi
