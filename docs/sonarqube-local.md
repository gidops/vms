# Local SonarQube (Docker)

Run code-quality / static-analysis scans against a **local SonarQube dashboard**
before pushing. Same scan scope as the SonarCloud CI step (both read
`sonar-project.properties`), but private, offline, and available on demand.

## Quick start

```bash
npm run sonar             # start SonarQube if needed + scan the repo
npm run sonar:coverage    # same, but runs backend jest coverage first
```

Then open <http://localhost:9000/dashboard?id=gidops_vms>. The script prints the
dashboard URL and the local admin login when it finishes.

> First boot takes **1–3 minutes** (Elasticsearch index build). Subsequent runs
> reuse the running server and are much faster.

## How it works

Everything lives behind the Docker Compose **`sonar` profile**, so a plain
`docker compose up -d` never starts it:

| Service         | Purpose                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sonar-db-init` | One-shot: creates a `sonar` database on the existing postgres container (SonarQube keeps its analysis history there, so image upgrades don't wipe it) |
| `sonarqube`     | The server (`sonarqube:community`), UI/API on **:9000**                                                                                               |
| `sonar-scanner` | One-shot scanner (`sonarsource/sonar-scanner-cli`), run per scan via `docker compose run` — repo mounted read-only, so it can't litter the worktree   |

`scripts/sonar-scan.sh` (what `npm run sonar` calls) is idempotent:

1. Starts `sonarqube` with `--wait` if not already healthy.
2. Waits for the API; auto-runs the DB migration after an image upgrade.
3. **First run only:** rotates the forced `admin`/`admin` password to a random
   value and issues a scanner token. Both are stored in the gitignored
   **`.sonar/`** dir (`admin_password`, `token`) and reused afterwards.
4. Runs the scanner (`SONAR_TOKEN` via env) and prints the dashboard URL.

Your personal dashboard login is `admin` + the password in
`.sonar/admin_password`.

## Relationship to SonarCloud (CI)

Both scans read the **same `sonar-project.properties`** (project key
`gidops_vms`, sources, exclusions, lcov path), so findings line up:

- **SonarCloud** — advisory scan in CI (`docs/github-actions-ci.md`); decorates
  PRs, never fails the build. The cloud-only `sonar.organization` is passed via
  the workflow's `args:`, not the properties file — a self-hosted server rejects
  that key, so don't re-add it there.
- **Local SonarQube** — pre-push deep dive on your machine. Rule versions may
  drift slightly from SonarCloud, so treat small diff-counts as noise.

## Lifecycle

```bash
docker compose --profile sonar stop sonarqube    # stop the server (state kept)
docker compose --profile sonar up -d sonarqube   # start it again
docker compose --profile sonar down              # stop + remove containers
```

Full reset (wipes analysis history and credentials):

```bash
docker compose --profile sonar down
docker volume rm vms_sonarqube_data
docker compose exec postgres psql -U vms -d vms -c 'DROP DATABASE sonar'
rm -rf .sonar
npm run sonar
```

Image upgrades (`docker compose --profile sonar pull sonarqube`) are safe: on
next `npm run sonar` the script detects `DB_MIGRATION_NEEDED` and migrates the
`sonar` database automatically.

## Troubleshooting

| Symptom                                      | Fix                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Docker daemon is not running`               | Start Docker Desktop, re-run                                                                                                                                             |
| Stuck at "starting SonarQube" for minutes    | Normal on first boot (ES indexing); the healthcheck allows ~5 min. Inspect with `docker compose --profile sonar logs -f sonarqube`                                       |
| SonarQube crashes/restarts repeatedly (WSL2) | Elasticsearch needs `vm.max_map_count ≥ 262144`: `sudo sysctl -w vm.max_map_count=262144` (persist in `/etc/sysctl.conf`, or `[wsl2] kernelCommandLine` in `.wslconfig`) |
| `admin credentials unknown`                  | `.sonar/` state lost after the server volume kept the rotated password (or vice-versa). Run the full reset above                                                         |
| Port 9000 already in use                     | Stop the other service or change the host port in `docker-compose.yml` (`"9000:9000"`) and `API=` in `scripts/sonar-scan.sh`                                             |
| No coverage on the dashboard                 | Coverage comes from `apps/backend/coverage/lcov.info`; use `npm run sonar:coverage`                                                                                      |
