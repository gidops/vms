# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AATC Visitor Management System (VMS) — tracks visitors at AATC.

## Stack

- **Frontend:** Next.js (TypeScript, App Router, Tailwind CSS), standalone output mode
- **Backend:** NestJS (TypeScript, REST API)
- **Database:** PostgreSQL 16
- **Infra:** Docker Compose for local dev, Terraform (AWS) for cloud
- **CI:** GitHub Actions

Node version is pinned to `20.11.0` via `.nvmrc`. Both apps declare `engines.node >=20.11.0` and `engines.npm >=10.0.0`.

## Repo layout

```
vms/
├── frontend/                # Next.js app (App Router, Tailwind, @/* alias)
│   ├── app/api/health/      # GET /api/health -> { status, timestamp }
│   ├── Dockerfile           # multi-stage build using Next.js standalone output
│   └── .env.example         # NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_API_BASE_URL
├── backend/                 # NestJS app (REST API)
│   ├── src/app.controller.ts  # GET / and GET /health -> { status, timestamp }
│   ├── Dockerfile           # multi-stage: deps -> builder -> prod-deps -> runner
│   └── .env.example         # DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT, NODE_ENV
├── terraform/               # AWS infra (VPC, subnet, IGW, SG, EC2)
├── .github/workflows/ci.yml # CI: lint + build for both apps
└── docker-compose.yml       # postgres + backend + frontend
```

Each app has its own `package.json`, `tsconfig.json`, and `node_modules`. Run all npm commands from inside the respective folder.

## Branches

- `main` — production
- `staging` — pre-prod
- `develop` — active development (default working branch)

CI runs on push and PR to all three branches.

## Commands

### Frontend (`cd frontend`)

| Task        | Command         |
| ----------- | --------------- |
| Dev server  | `npm run dev`   |
| Build       | `npm run build` |
| Start prod  | `npm start`     |
| Lint        | `npm run lint`  |

Dev server runs on `http://localhost:3000`. Turbopack is intentionally disabled.

### Backend (`cd backend`)

| Task                | Command                              |
| ------------------- | ------------------------------------ |
| Dev server (watch)  | `npm run start:dev`                  |
| Start               | `npm start`                          |
| Start prod          | `npm run start:prod`                 |
| Build               | `npm run build`                      |
| Lint (auto-fix)     | `npm run lint`                       |
| Lint (CI, no fix)   | `npm run lint:check`                 |
| Unit tests          | `npm test`                           |
| Single test file    | `npm test -- path/to/file.spec.ts`   |
| E2E tests           | `npm run test:e2e`                   |
| Coverage            | `npm run test:cov`                   |

Nest listens on `process.env.PORT ?? 3000` (`backend/src/main.ts:6`). When running directly alongside the frontend, set `PORT=4000` in `backend/.env` to avoid clashing. In Docker the backend's `PORT` is `4000`.

CI uses `lint:check` (no `--fix`) so any lint finding fails the build — leave the `lint` script alone if you want auto-fix locally.

## Health checks

- **Frontend:** `GET /api/health` → `{ status: "ok", timestamp: <ISO> }` (`frontend/app/api/health/route.ts`). Marked `dynamic = "force-dynamic"` so the timestamp isn't statically cached.
- **Backend:** `GET /health` → `{ status: "ok", timestamp: <ISO> }` (handler on `AppController`). Lives on the existing controller — extract to a dedicated `HealthModule` if you add DB/liveness/readiness checks.

## Environment variables

`.env` files are gitignored; only `.env.example` is checked in. Copy them before running:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

**Frontend** (`frontend/.env.example`):
- `NEXT_PUBLIC_APP_URL` — public URL of the frontend
- `NEXT_PUBLIC_API_BASE_URL` — public URL of the backend (e.g. `http://localhost:4000`)

**Backend** (`backend/.env.example`):
- `DATABASE_URL` — Postgres connection string. In Docker Compose: `postgres://vms:vms@postgres:5432/vms`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `PORT` — set to `4000` in Docker; can be any free port locally
- `NODE_ENV`

Frontend's `.gitignore` has an explicit `!.env.example` exception because the broad `.env*` rule would otherwise hide it.

## Docker

`docker-compose.yml` defines three services:

| Service  | Host port | Image / build         | Notes                                            |
| -------- | --------- | --------------------- | ------------------------------------------------ |
| postgres | 5432      | `postgres:16-alpine`  | named volume `postgres_data`; healthchecked      |
| backend  | 4000      | `./backend` (build)   | `env_file: ./backend/.env`; waits for healthy DB |
| frontend | 3000      | `./frontend` (build)  | `env_file: ./frontend/.env`; depends on backend  |

Postgres defaults: user `vms`, password `vms`, db `vms`. Match these in `backend/.env`'s `DATABASE_URL`.

```bash
docker compose up --build
```

Both Dockerfiles run as non-root (`nextjs` / `nestjs` uid 1001) and use Node 20.11.0-alpine. Frontend uses Next.js standalone output (`output: "standalone"` in `next.config.ts`); the runner stage assembles `public/` and `.next/static` alongside `server.js`. Backend uses a separate `prod-deps` stage so dev dependencies don't ship in the runtime image.

## Terraform (`terraform/`)

Provisions a single-instance frontend host in AWS:

- VPC `10.0.0.0/16` with one public subnet `10.0.1.0/24`, internet gateway, public route table
- Security group: inbound `80`, `443`, `22` from `0.0.0.0/0`; all egress
- EC2 (`t2.micro` by default) running latest Canonical Ubuntu 22.04 AMI
- `user_data`: installs Node 20, clones the `develop` branch into `/opt/vms`, builds the frontend, and runs the Next.js standalone server on port 80

Variables (see `variables.tf`): `region` (us-east-1), `instance_type` (t2.micro), `project_name` (vms), `key_name` (vms-key).

Output: `public_ip` of the instance.

**Prerequisites before `terraform apply`:**
- AWS credentials configured (env vars or `~/.aws/credentials`).
- An EC2 key pair named `vms-key` must exist in the target region — Terraform does not create it. Override `-var key_name=…` to use a different name.
- The GitHub repo must be reachable without auth (public) for `user_data` to clone successfully; otherwise the build step fails silently and the instance will not serve.

State is local (no remote backend configured). `terraform/.gitignore` excludes `.terraform/`, `terraform.tfstate`, `terraform.tfstate.backup`, and `*.tfvars`.

The server is started with `nohup`, not systemd — fine for a smoke test, not for anything durable. Add a systemd unit if you need restart-on-reboot.

## CI (`.github/workflows/ci.yml`)

Triggers on push and PR to `develop`, `staging`, `main`. Two parallel jobs on `ubuntu-latest`, Node 20.11.0, with npm cache keyed off each app's lockfile:

1. **frontend** — `npm ci` → `npm run lint` → `npm run build`
2. **backend** — `npm ci` → `npm run lint:check` → `npm run build`
