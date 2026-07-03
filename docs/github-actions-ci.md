# GitHub Actions CI — VMS

This document describes the GitHub Actions CI pipeline for the VMS monorepo: its
architecture, the secrets it requires, how it is triggered, and how it coexists
with the existing Jenkins pipeline.

## Purpose

GitHub Actions provides a cost-effective, always-on CI pipeline that runs the
same validation and build checks as Jenkins, with status reported directly on
pull requests. Jenkins remains fully functional and unchanged; the two run side
by side (Actions for routine PR validation, Jenkins retained for comparison and
as a fallback, and for CD).

## Workflow file

`.github/workflows/ci.yml`

### Triggers

- `push` to `develop`, `staging`, `main`
- `pull_request` targeting `develop`, `staging`, `main`

PRs therefore trigger CI automatically, and status appears on the PR.

### Jobs

**`apps` — Apps (lint + typecheck + build)**, on `ubuntu-latest`:

1. Checkout (`actions/checkout`)
2. Setup Node 20.11.0 with npm cache (`actions/setup-node`)
3. `npm ci` — install workspace dependencies (runs `prisma generate` on postinstall)
4. `npx turbo run lint:check`
5. `npx turbo run typecheck`
6. `npx turbo run build`
7. `npx turbo run build-storybook`
8. `npx turbo run test` — unit tests (generates backend coverage)
9. Backend coverage gate — `npm run test:cov -w @vms/backend`
10. e2e tests against a Postgres 16 service container (`npm run test:e2e -w @vms/backend`)
11. **SonarCloud analysis (advisory)** — see below

A Postgres 16 service container is provisioned for the e2e step
(`vms` / `vms` / `vms_test` on port 5432).

**`terraform` — Terraform (fmt + validate)**, on `ubuntu-latest`:

1. Checkout
2. Setup Terraform (`hashicorp/setup-terraform`)
3. `terraform fmt -check`
4. `terraform init -backend=false`
5. `terraform validate`

### SonarCloud analysis (advisory)

The final step of the `apps` job runs a SonarCloud scan. It is **advisory**:
`continue-on-error: true` means a failing SonarCloud quality gate reports to
SonarCloud and decorates the PR, but does **not** fail the CI job. This matches
the branch-protection policy, where the SonarCloud check is not a required gate.

Scan configuration (project key `gidops_vms`, organization `vmsvms`, analysed
sources, and the coverage report path `apps/backend/coverage/lcov.info`) is read
from `sonar-project.properties` at the repo root. Coverage is produced by the
backend coverage step earlier in the job.

> Action version: the workflow uses `SonarSource/sonarqube-scan-action`. Confirm
> the current major version at
> https://github.com/SonarSource/sonarqube-scan-action and pin accordingly.
> (`sonarqube-scan-action` supersedes the deprecated `sonarcloud-github-action`.)

## Required secrets

Set under: repository **Settings → Secrets and variables → Actions → New repository secret**.

| Secret        | Used by              | Notes                                                                                                                                           |
| ------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `SONAR_TOKEN` | SonarCloud scan step | SonarCloud analysis token for project `gidops_vms` (organization `vmsvms`). Same token value used by the Jenkins `sonarcloud-token` credential. |

No AWS or other secrets are required for CI. (Deployment/CD is a separate
pipeline and a separate concern — not part of this CI workflow.)

## Coexistence with Jenkins

- This workflow does **not** modify, disable, or depend on Jenkins. The
  Jenkinsfile and Jenkins jobs remain unchanged and functional.
- On a PR you will see GitHub Actions checks (`Apps (lint + typecheck + build)`,
  `Terraform (fmt + validate)`) alongside any Jenkins-reported checks.
- Either system can be used to validate a change; they run independently.

## Maintenance notes

- **Node version** is pinned to `20.11.0` (matches `.nvmrc` and the Jenkins
  agent image). Update in both places together if bumping.
- **Turbo tasks** (`lint:check`, `typecheck`, `build`, `build-storybook`, `test`)
  mirror the Jenkins CI sequence; keep them in sync if either changes.
- The SonarCloud step is advisory by design. To make it blocking later, remove
  `continue-on-error: true` and add the SonarCloud check to the branch
  protection required checks.
