# AATC Visitor Management System (VMS)

AATC VMS is a visitor management system that handles the full lifecycle of a
guest visit, from request to check-in. A staff member raises a visit request on
behalf of their guest; a security officer reviews and approves it; the guest is
then notified by email; and on arrival, the guest proceeds to the VMC
(reception), where the receptionist checks them in. The system supports four
roles — admin, staff, security officer, and receptionist (VMC).

Note: this describes the target system; the approval workflow, roles, and email
notifications are in progress. The current build covers the core stack, visitor
records, and infrastructure.

A typed full-stack monorepo for tracking visitors at AATC. It pairs a Next.js
frontend with a NestJS backend over a PostgreSQL database, with reproducible
local development via Docker Compose and one-command cloud provisioning via
Terraform.

## What's inside

- **Typed full-stack monorepo** — Next.js (TypeScript, App Router) frontend and
  NestJS (TypeScript) backend, each independently buildable and Dockerised.
- **Persisted visitor records** — a Postgres-backed `Visitor` model accessed via
  Prisma, with schema versioned through Prisma migrations.
- **DB-aware health checks** — the backend's `GET /health` pings the database;
  the frontend exposes its own `GET /api/health`.
- **One-command local dev** — `docker-compose up --build` brings up Postgres, the
  backend, the frontend, and Adminer on a shared network.
- **Self-migrating backend container** — on every start the backend waits for the
  DB, runs `prisma migrate deploy`, then starts Node. No manual migration step.
- **CI gates** — GitHub Actions lints and builds both apps and validates the
  Terraform on every push / PR to `develop`, `staging`, `main`.
- **One-command AWS provisioning** — Terraform builds a VPC, subnets, EC2
  instances for the frontend and backend, and an RDS Postgres instance.

## Stack

| Layer        | Technology                                              |
| ------------ | ------------------------------------------------------- |
| Frontend     | Next.js (TypeScript, App Router, Tailwind CSS)          |
| Backend      | NestJS (TypeScript, REST API)                           |
| ORM          | Prisma 6 (`prisma-client-js`)                           |
| Database     | PostgreSQL 16                                           |
| DB browser   | Adminer (local dev only)                                |
| Local infra  | Docker Compose                                          |
| Cloud infra  | Terraform (AWS)                                         |
| CI           | GitHub Actions                                          |

Node is pinned to `20.11.0` via `.nvmrc`; both apps declare
`engines.node >=20.11.0` and `engines.npm >=10.0.0`.

> **npm only.** This project uses npm for every command. Do not use yarn, pnpm,
> or bun.

## Repository structure

```
vms/
├── frontend/                 # Next.js app (App Router, Tailwind, @/* alias) — see frontend/README.md
├── backend/                  # NestJS app + Prisma (REST API) — see backend/README.md
├── terraform/                # AWS infra (VPC + subnets, EC2 x2, RDS, SGs)
├── .github/workflows/ci.yml  # CI: lint + build (both apps) + terraform validate
└── docker-compose.yml        # postgres + backend + frontend + adminer
```

Each app has its own `package.json`, `tsconfig.json`, and `node_modules`. Run
npm commands from inside the respective folder. For app-specific detail, see:

- **[frontend/README.md](frontend/README.md)** — Next.js dev, build, env vars.
- **[backend/README.md](backend/README.md)** — NestJS dev, build, Prisma, health.

## Local development

### Ports

| Service  | Port |
| -------- | ---- |
| frontend | 3000 |
| backend  | 4000 |
| adminer  | 8080 |
| postgres | 5432 |

### Prerequisites

- Node `20.11.0` (run `nvm use` to pick it up from `.nvmrc`)
- Docker + Docker Compose (for the one-command path)

### Quickstart with Docker Compose (recommended)

From a fresh clone:

```bash
nvm use                                    # picks Node 20.11.0 from .nvmrc
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
docker-compose up --build                  # postgres + backend + frontend + adminer
```

Then:

- Frontend: <http://localhost:3000>
- Backend health: <http://localhost:4000/health>
- Adminer (DB browser): <http://localhost:8080> — system **PostgreSQL**, server
  **postgres**, user/pass/db **vms/vms/vms**

Migrations run automatically on backend start, so the `Visitor` table exists by
the time the API is up.

### Docker Compose services

| Service  | Host port | Notes                                             |
| -------- | --------- | ------------------------------------------------- |
| postgres | 5432      | `postgres:16-alpine`; named volume; healthchecked |
| backend  | 4000      | builds `./backend`; waits for a healthy DB        |
| frontend | 3000      | builds `./frontend`; depends on backend           |
| adminer  | 8080      | browse the DB in your browser at `:8080`          |

### Running the apps directly (without Docker)

Start each app from its own folder — see the app READMEs for full detail:

```bash
cd frontend && npm install && npm run dev    # http://localhost:3000
cd backend  && npm install && npm run start:dev
```

When running the backend directly alongside the frontend, set `PORT=4000` in
`backend/.env` so it doesn't clash with the frontend's `3000`.

## Environment variables

`.env` files are gitignored; only `.env.example` is checked in. Copy them before
running:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

- **Frontend** — `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_BASE_URL`.
- **Backend** — `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `NODE_ENV`.

> **Database host gotcha.** Inside Docker Compose, `DATABASE_URL` must use the
> service hostname `postgres` (e.g. `postgresql://vms:vms@postgres:5432/vms`).
> When running the Prisma CLI from your host (e.g. `npx prisma migrate dev`),
> switch the host to `localhost`.

See each app's README and `.env.example` for the full list.

## CI/CD

CI is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and runs
on every push and pull request to `develop`, `staging`, and `main`. Three
parallel jobs run on `ubuntu-latest` (Node `20.11.0`):

1. **frontend** — `npm ci` → `npm run lint` → `npm run build`
2. **backend** — `npm ci` → `npm run lint:check` → `npm run build`
3. **terraform** — `terraform fmt -check` → `terraform init -backend=false` →
   `terraform validate`

Branch protection workflow: open a feature branch, push, and let CI gate the
PR. All three jobs must pass before merge.

## Infrastructure (Terraform)

The [`terraform/`](terraform/) directory provisions the full VMS stack in AWS
(default region `us-east-1`):

- a VPC with two public subnets across two AZs, an internet gateway, and route
  tables;
- security groups for the frontend, backend, and RDS (Postgres reachable only
  from the backend SG);
- an **EC2 frontend** (port 80) and an **EC2 backend** (port 4000), each of
  which clones `develop`, builds, and starts on boot;
- an **RDS Postgres 16** instance (private), with a generated DB password.

State is local and there is no remote backend configured — switch to an
encrypted remote backend before sharing state. See the comments in
`terraform/` and the project `CLAUDE.md` for prerequisites (AWS credentials, an
existing `vms-key` EC2 key pair) and the full resource breakdown.

## Troubleshooting

- **`npm ci` fails during the Docker build with `ECONNRESET` / network errors.**
  An unstable network dropped the connection. The Dockerfile sets npm retry
  config, so just re-run the build and it will retry.
- **Backend container crash-loops with `@prisma/client did not initialize yet.
  Please run prisma generate`.** The Prisma client wasn't generated in the
  image. Rebuild with `docker-compose build` so the Dockerfile's
  `prisma generate` step runs — don't run a stale cached image.
- **Backend can't reach the database / health shows `disconnected`.** Wrong
  `DATABASE_URL` host. Use `postgres` inside Docker, `localhost` when running the
  Prisma CLI from your host.
- **(WSL) git or npm fail with `Temporary failure in name resolution`, or
  `docker` is "command not found".** WSL lost network/DNS, or Docker Desktop
  isn't running / its WSL integration is inactive. Start Docker Desktop, run
  `wsl --shutdown` in a Windows terminal then reopen, and ensure Docker
  Desktop's WSL integration is enabled for this distro.

## Branches & contributing

Three long-lived branches:

- `main` — production
- `staging` — pre-prod
- `develop` — active development (default working branch)

CI runs on push and PR to all three. Workflow:

1. Branch off `develop` for your change (e.g. `feature/...`, `fix/...`).
2. Push and open a pull request targeting `develop`.
3. Let CI (lint + build + terraform validate) pass and get the PR reviewed.
4. Merge once approved and green.

Promotion flows `develop` → `staging` → `main` via PRs as changes are
validated.
