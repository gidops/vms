# CI and code quality

**Who this is for:** developers and maintainers. **What you'll learn:** which
automated checks guard every change, how coverage and SonarQube work, and how a
release reaches AWS through Jenkins.

Two systems, two jobs:

| System             | Job                                   | File                       |
| ------------------ | ------------------------------------- | -------------------------- |
| **GitHub Actions** | The single quality gate (CI)          | `.github/workflows/ci.yml` |
| **Jenkins**        | Deploy only, by hand, after CI passed | `Jenkinsfile`              |

**CI** (continuous integration) means every push and pull request is built and
tested automatically.

## GitHub Actions (the quality gate)

Runs on every push and pull request to `develop`, `staging` and `main`. Branch
protection on `main` and `staging` requires it to pass before merging.

**Job "Apps (lint + typecheck + build)"** (Ubuntu, Node 20.11.0):

1. `npm ci` (also runs `prisma generate`)
2. `npx turbo run lint:check`
3. `npx turbo run typecheck`
4. `npx turbo run build`
5. `npx turbo run build-storybook`
6. `npx turbo run test` (unit tests for all workspaces)
7. Backend coverage gate: `npm run test:cov -w @vms/backend`
8. Frontend coverage: `npm run test:cov -w @vms/frontend`
9. Backend e2e tests (`npm run test:e2e -w @vms/backend`) against a Postgres 16
   service container, database `vms_test`
10. SonarCloud scan (advisory, see below)

**Job "Terraform (fmt + validate)"**: `terraform fmt -check`,
`terraform init -backend=false`, `terraform validate` (Terraform 1.15.6).

The repository secret `SONAR_TOKEN` (Settings → Secrets and variables →
Actions) is the only secret CI needs.

## Tests and coverage

**Coverage** is the share of code that tests execute.

| Workspace | Runner | Tests live in                                                            | Coverage                                                                                                                                         |
| --------- | ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend   | Jest   | `*.spec.ts` next to the source; e2e in `apps/backend/test/*.e2e-spec.ts` | **Enforced**: statements 60%, branches 50%, functions 55%, lines 60% (`coverageThreshold` in `apps/backend/package.json`). Below that, CI fails. |
| Frontend  | Vitest | `*.test.ts(x)` next to the source                                        | Measured with `npm run test:cov -w @vms/frontend`, reported to Sonar                                                                             |

Adding backend code without tests can push coverage under the gate.

## SonarQube / SonarCloud

**SonarQube** is a static analysis tool: it reports bugs, code smells,
duplication and coverage. **SonarCloud** is its hosted version.

Both read `sonar-project.properties`:

- project key `gidops_vms`; sources: backend `src`, frontend, contracts, tokens,
  ui;
- `*.spec.ts`, `*.e2e-spec.ts`, `*.test.ts`, `*.test.tsx` are treated as tests,
  not sources;
- coverage from `apps/backend/coverage/lcov.info` and
  `apps/frontend/coverage/lcov.info`.

### SonarCloud in CI

The last CI step runs `SonarSource/sonarqube-scan-action` with
`continue-on-error: true`. It decorates pull requests but **does not fail CI**.
The organisation (`vmsvms`) is passed in the workflow, not the properties file,
because a self-hosted SonarQube rejects that key. To make it blocking: remove
`continue-on-error` and add the Sonar check to branch protection.

### Local SonarQube

Run the same analysis on your machine before pushing:

```bash
npm run sonar             # start SonarQube in Docker if needed, then scan
npm run sonar:coverage    # run backend coverage first, then scan
```

Open <http://localhost:9000/dashboard?id=gidops_vms>. First start takes 1–3
minutes. `npm run sonar:coverage` only regenerates backend coverage; run
`npm run test:cov -w @vms/frontend` first to include the frontend.

How it works: the Docker Compose `sonar` profile has three services:
`sonar-db-init` (creates a `sonar` database in the existing Postgres),
`sonarqube` (the server, port 9000) and `sonar-scanner` (one-off scanner, repo
mounted read-only). `scripts/sonar-scan.sh`:

1. starts SonarQube and waits until it is healthy (migrating its database after
   an image upgrade);
2. on first run, replaces the default `admin`/`admin` password with a random one
   and creates a scanner token, both saved in the gitignored `.sonar/` folder;
3. runs the scanner and prints the dashboard URL.

Your login is `admin` plus the password in `.sonar/admin_password`.

Lifecycle:

```bash
docker compose --profile sonar stop sonarqube    # stop (keeps data)
docker compose --profile sonar up -d sonarqube   # start again
docker compose --profile sonar down              # remove containers
```

Full reset (deletes history and credentials):

```bash
docker compose --profile sonar down
docker volume rm vms_sonarqube_data
docker compose exec postgres psql -U vms -d vms -c 'DROP DATABASE sonar'
rm -rf .sonar
npm run sonar
```

| Problem                           | Fix                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "Docker daemon is not running"    | Start Docker and re-run.                                                                             |
| SonarQube keeps restarting (WSL2) | Its search engine needs `sudo sysctl -w vm.max_map_count=262144` (persist it in `/etc/sysctl.conf`). |
| "admin credentials unknown"       | `.sonar/` and the server volume are out of sync. Do the full reset.                                  |
| Port 9000 in use                  | Free it, or change the port in `docker-compose.yml` and `API=` in `scripts/sonar-scan.sh`.           |
| No coverage on the dashboard      | Generate the lcov files first (see above).                                                           |

## Deploying with Jenkins

Jenkins does no quality checks; it only deploys code that already passed GitHub
Actions.

1. Open the pipeline job for `main` or `staging` and choose **Build with
   Parameters**.
2. Tick **DEPLOY** and pick **DEPLOY_TARGET** (`both`, `backend` or
   `frontend`). Without DEPLOY ticked, the build does nothing.
3. Jenkins refuses any branch other than `main` or `staging`.
4. It runs `scripts/require-github-checks.sh <commit>`, which asks the GitHub API
   whether the jobs "Apps (lint + typecheck + build)" and "Terraform (fmt +
   validate)" succeeded on **that exact commit**. If not, the deploy stops.
5. Jenkins pauses for a person to press **Deploy** (manual approval).
6. It runs `./vms-deploy.sh --deploy <target>` with `VMS_AUTO_APPROVE=1`. See
   [operations.md](./operations.md#8-deploying-to-aws) for what that does.

### Jenkins setup

- **Plugins:** Git, Credentials Binding.
- **Agent:** a node labelled `vms-deploy` with Docker, AWS CLI v2, Terraform 1.9
  or newer, `curl` and `python3`.
- **Credentials:** `github-checks-token`, of type **Secret text**: a
  fine-grained GitHub token with **read-only Checks** access to the repository.
  No AWS keys are stored; AWS access comes from the agent's EC2 instance role.
- **Job:** a Multibranch Pipeline (or Pipeline from SCM) using the `Jenkinsfile`
  at the repo root.
- The Jenkins server itself is created by the Terraform in `jenkins/`.
