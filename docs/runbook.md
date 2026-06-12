# Runbook

How to run, configure, and operate the VMS locally and in containers.

## Prerequisites

- **Node 20.x** (`nvm use` → `20.11.0` from `.nvmrc`)
- **Docker Desktop** running (PostgreSQL)
- npm ≥ 10

## Local dev (recommended: DB in Docker, apps with hot reload)

```bash
nvm use
npm install                                  # single root install
npx turbo run build                          # build shared packages (e.g. @vms/contracts dist)

docker compose up -d postgres adminer        # PostgreSQL + Adminer
cd apps/backend && npx prisma migrate deploy && cd ../..   # apply migrations

npm run start:dev -w @vms/backend            # terminal 1 → http://localhost:4000
npm run dev       -w @vms/frontend           # terminal 2 → http://localhost:3000
```

Sign in at <http://localhost:3000> with the dev seed account:

| Email | Password |
| --- | --- |
| `admin@aatc.org` | `Passw0rd!` |

The backend seeds the permission catalogue, the `ADMIN` / `CSO` / `RECEPTION`
roles, this user, and a set of demo visit requests + an alert on startup in
non‑production (idempotent) — so the Requests & Alerts inbox renders with data.

### URLs

| Service | URL |
| --- | --- |
| Frontend (login) | <http://localhost:3000/> (`/fr`, `/ar` for FR/AR) |
| Dashboard | <http://localhost:3000/dashboard> |
| Backend health | <http://localhost:4000/health> |
| Adminer | <http://localhost:8080> — System **PostgreSQL**, server **postgres**, user/pass/db **vms/vms/vms** |
| Storybook | `npm run storybook -w @vms/ui` |

## Full Docker (one command)

```bash
# Set the DB host to the compose service name first:
#   apps/backend/.env →  DATABASE_URL="postgresql://vms:vms@postgres:5432/vms"
docker compose up --build        # postgres + backend + frontend + adminer
```

The backend container's entrypoint waits for the DB, runs `prisma migrate
deploy`, then starts.

> **The `DATABASE_URL` host gotcha:** use **`localhost`** when the backend runs on
> your host (dev workflow), **`postgres`** when it runs inside compose.

## Environment variables

`.env` files are gitignored; `.env.example` is committed; dev `.env` files are
pre‑created. The backend validates its env with a zod schema at boot and **fails
fast** on a missing/invalid variable.

**Backend** (`apps/backend/.env`):

| Var | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres URL (`localhost` host for dev, `postgres` in compose) |
| `JWT_SECRET` | signing secret for access tokens |
| `JWT_EXPIRES_IN` | e.g. `1h`, `15m` |
| `PORT` | `4000` |
| `NODE_ENV` | `development` / `production` |
| `LOG_LEVEL` | optional (`info` default) |
| `ENCRYPTION_KEY` | optional base64 32‑byte key; derived from `JWT_SECRET` in dev |
| `OUTBOX_POLL_INTERVAL_MS` | optional (`2000` default) |

**Frontend** (`apps/frontend/.env`): `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_BASE_URL`.

## Commands

From the repo root (Turbo):

```bash
npx turbo run build
npx turbo run dev
npx turbo run lint:check typecheck test
npx turbo run build-storybook
```

Scoped to a workspace:

```bash
npm run <script> -w @vms/backend     # start:dev, build, test, lint
npm run <script> -w @vms/frontend    # dev, build
npm run storybook -w @vms/ui
```

Prisma (run from `apps/backend`, reads `.env`):

```bash
npx prisma migrate dev --name <name>   # create + apply (dev)
npx prisma migrate deploy              # apply (prod/CI)
npx prisma studio                      # browse data
npx prisma generate                    # regenerate client (also runs on install)
```

Docker:

```bash
docker compose up -d postgres adminer  # just the DB + browser
docker compose up --build              # full stack
docker compose down                    # stop (add -v to wipe the DB volume)
```

## Verification

```bash
npx turbo run lint:check typecheck build build-storybook test
```

`GET /health` reports DB connectivity. CI runs the same gates plus Terraform
`fmt`/`validate`.

## Deployment (Terraform / AWS)

`terraform/` provisions a VPC (+2 subnets), two EC2 instances (frontend :80,
backend :4000), and an RDS Postgres 16 instance. `user_data` clones `develop`,
installs deps, and builds from the monorepo root via `turbo --filter`.

Prerequisites: AWS credentials, an existing EC2 key pair (`vms-key`), and a
reachable repo. State is local — move to an encrypted remote backend before team
use (it holds the generated DB password).

## Troubleshooting

- **Backend 500s / `database: "disconnected"`** — Postgres not up or
  `DATABASE_URL` host wrong (`localhost` vs `postgres`). `docker compose ps`.
- **`@vms/contracts` not found / type errors in an app** — run
  `npx turbo run build` once so the contracts `dist` exists.
- **Login fails** — ensure migrations ran and the backend booted (the seeder logs
  `Seeded admin user …` on first run).
- **Port already in use** — backend `PORT` (4000) or frontend (3000); stop the
  other process or change the port.
