# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AATC Visitor Management System (VMS) — tracks visitors at AATC. A typed full-stack monorepo with reproducible local development and one-command cloud provisioning.

## What's built

Concrete capabilities present in the repo today:

- **Typed full-stack monorepo** — Next.js (TS, App Router) frontend and NestJS (TS) backend, each independently buildable and Dockerised.
- **Persisted Visitor records** — Postgres-backed `Visitor` model (name, email, phone, host, purpose, check-in/check-out, timestamps) accessed via Prisma. Schema is versioned through Prisma migrations.
- **DB-aware health endpoint** — `GET /health` on the backend pings the database with `SELECT 1` and reports `connected` / `disconnected`. The frontend exposes its own `GET /api/health`.
- **Reproducible local dev with one command** — `docker compose up --build` brings up Postgres, the backend, the frontend, and Adminer (a web DB browser) on a shared network.
- **Self-migrating backend container** — on every start the backend waits for the DB to be reachable, runs `prisma migrate deploy`, then execs Node. No manual migration step.
- **CI gates** — GitHub Actions lints and builds both apps on every push / PR to `develop`, `staging`, `main`.
- **One-command AWS provisioning** — Terraform builds VPC + 2 subnets, two EC2 instances (frontend on port 80, backend on port 4000), an RDS Postgres 16 instance, security groups, and a generated DB password. Each EC2 boots, clones `develop`, builds, and starts.
- **Reproducible toolchain** — Node `20.11.0` pinned via `.nvmrc`; both apps declare `engines.node >=20.11.0` and `engines.npm >=10.0.0`.

## Stack

- **Frontend:** Next.js (TypeScript, App Router, Tailwind CSS), standalone output mode
- **Backend:** NestJS (TypeScript, REST API)
- **ORM:** Prisma 6 (`prisma-client-js` generator)
- **Database:** PostgreSQL 16
- **DB browser (dev):** Adminer
- **Infra:** Docker Compose for local dev, Terraform (AWS) for cloud
- **CI:** GitHub Actions

## Local quickstart

From a fresh clone:

```bash
nvm use                                        # picks Node 20.11.0 from .nvmrc
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
docker compose up --build                      # postgres + backend + frontend + adminer
```

Then:
- Frontend: <http://localhost:3000>
- Backend health: <http://localhost:4000/health>
- Adminer (DB browser): <http://localhost:8080> — system **PostgreSQL**, server **postgres**, user/pass/db **vms/vms/vms**

Migrations run automatically on backend start, so the `Visitor` table will exist by the time the API is up.

## Architecture overview

Request flow at runtime:

```
Browser → Next.js (3000) → NestJS (4000) → PrismaService → Postgres (5432)
                                         ↘ GET /health pings the DB
```

The backend's `AppController` injects `PrismaService`, which extends `PrismaClient` and binds `$connect` / `$disconnect` to the Nest lifecycle. `PrismaModule` exports it for other modules to consume.

Deployment story:

```
push to develop
   → CI: lint + build (frontend, backend)
terraform apply
   → VPC + 2 subnets + IGW + SGs
   → RDS Postgres 16 (private)
   → EC2 frontend (port 80) — user_data clones develop, builds, runs Next.js standalone
   → EC2 backend  (port 4000) — user_data clones develop, builds, runs Nest with DATABASE_URL from RDS
```

In containerised environments (Compose or any orchestrator that runs the backend image), the entrypoint script handles schema convergence so every fresh start ends with the database matching `prisma/schema.prisma`.

## Repo layout

```
vms/
├── frontend/                       # Next.js app (App Router, Tailwind, @/* alias)
│   ├── app/api/health/             # GET /api/health -> { status, timestamp }
│   ├── Dockerfile                  # multi-stage build using Next.js standalone output
│   └── .env.example                # NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_API_BASE_URL
├── backend/                        # NestJS app (REST API)
│   ├── src/app.controller.ts       # GET / and GET /health (DB-aware)
│   ├── src/prisma/                 # PrismaService + PrismaModule
│   ├── prisma/schema.prisma        # Prisma schema (datasource + Visitor model)
│   ├── prisma/migrations/          # SQL migration history
│   ├── Dockerfile                  # multi-stage: deps -> builder -> prod-deps -> runner
│   ├── docker-entrypoint.sh        # waits for DB, runs migrate deploy, execs node
│   └── .env.example                # DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT, NODE_ENV
├── terraform/                      # AWS infra (VPC + 2 subnets, EC2 x2, RDS, SGs)
├── .github/workflows/ci.yml        # CI: lint + build for both apps
└── docker-compose.yml              # postgres + backend + frontend + adminer
```

Each app has its own `package.json`, `tsconfig.json`, and `node_modules`. Run all npm commands from inside the respective folder. The backend runtime image bundles the Prisma CLI plus the `prisma/` folder (schema + migrations) so the entrypoint can run migrations on container start.

## Branches

- `main` — production
- `staging` — pre-prod
- `develop` — active development (default working branch)

CI runs on push and PR to all three branches. As of writing, `main` and `staging` lag `develop` significantly — most of the project lives on `develop` and has not yet been promoted.

## Commands

### Frontend (`cd frontend`)

| Task        | Command         |
| ----------- | --------------- |
| Dev server  | `npm run dev`   |
| Build       | `npm run build` |
| Start prod  | `npm start`     |
| Lint        | `npm run lint`  |

Dev server runs on `http://localhost:3000`.

### Backend (`cd backend`)

| Task                   | Command                                       |
| ---------------------- | --------------------------------------------- |
| Dev server (watch)     | `npm run start:dev`                           |
| Start                  | `npm start`                                   |
| Start prod             | `npm run start:prod`                          |
| Build                  | `npm run build`                               |
| Lint (auto-fix)        | `npm run lint`                                |
| Lint (CI, no fix)      | `npm run lint:check`                          |
| Unit tests             | `npm test`                                    |
| Single test file       | `npm test -- path/to/file.spec.ts`            |
| E2E tests              | `npm run test:e2e`                            |
| Coverage               | `npm run test:cov`                            |
| Prisma — generate      | `npx prisma generate`                         |
| Prisma — migrate (dev) | `npx prisma migrate dev --name <name>`        |
| Prisma — migrate (prod / CI) | `npx prisma migrate deploy`             |
| Prisma — Studio        | `npx prisma studio`                           |

Nest listens on `process.env.PORT ?? 3000` (`backend/src/main.ts:6`). When running directly alongside the frontend, set `PORT=4000` in `backend/.env` to avoid clashing. In Docker the backend's `PORT` is `4000`.

CI uses `lint:check` (no `--fix`) so any lint finding fails the build — leave the `lint` script alone if you want auto-fix locally.

## Health checks

- **Frontend:** `GET /api/health` → `{ status: "ok", timestamp: <ISO> }` (`frontend/app/api/health/route.ts`). Marked `dynamic = "force-dynamic"` so the timestamp isn't statically cached.
- **Backend:** `GET /health` (handler on `AppController`) pings the DB via ``prisma.$queryRaw`SELECT 1` `` inside a try/catch and returns:
  - Success: `{ status: "ok", database: "connected", timestamp: <ISO> }`
  - Failure: `{ status: "ok", database: "disconnected", error: <message>, timestamp: <ISO> }`
  - `status` is intentionally `"ok"` in both branches — if you wire this into an external probe that needs to alert on DB outages, key off `database` (or change the failure branch's status).

## Database (Prisma)

Pinned to **Prisma `^6.19.3`** (`@prisma/client` runtime + `prisma` devDep). Prisma 7 was tried briefly but reverted — it requires Node ≥20.19, while the project pins 20.11.0 via `.nvmrc`.

- **Schema:** `backend/prisma/schema.prisma`. Generator is `prisma-client-js`, default output to `node_modules/@prisma/client` (so you `import { PrismaClient } from '@prisma/client'`). Datasource is `postgresql` with `url = env("DATABASE_URL")`.
- **Models:** `Visitor` — `id` (Int, autoincrement PK), `fullName`, `email` (unique), `phone?`, `hostName`, `purpose`, `checkIn` (`@default(now())`), `checkOut?`, `createdAt` (`@default(now())`), `updatedAt` (`@updatedAt`).
- **Migrations:** `backend/prisma/migrations/`. Current history is one migration: `20260529110322_init_visitor`.
- **PrismaService** (`backend/src/prisma/prisma.service.ts`) extends `PrismaClient` and implements `OnModuleInit` / `OnModuleDestroy` to `$connect` / `$disconnect` with the Nest lifecycle.
- **PrismaModule** (`backend/src/prisma/prisma.module.ts`) provides and exports `PrismaService`; wired into `AppModule.imports`.
- **Usage:** `constructor(private readonly prisma: PrismaService) {}` then `this.prisma.visitor.findMany()` etc.
- **Tests:** Any spec that constructs a controller/provider that depends on `PrismaService` must register a mock provider. See `backend/src/app.controller.spec.ts` — it registers `{ provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue([...]) } }`.

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
- `DATABASE_URL` — Postgres connection string. Inside Docker Compose use the service hostname: `postgresql://vms:vms@postgres:5432/vms`. When running Prisma CLI on the host (e.g. `npx prisma migrate dev`), switch the host to `localhost`. `backend/.env` carries a comment reminding of this.
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `PORT` — set to `4000` in Docker; can be any free port locally
- `NODE_ENV`

Frontend's `.gitignore` has an explicit `!.env.example` exception because the broad `.env*` rule would otherwise hide it.

## Docker

`docker-compose.yml` defines four services on the default Compose network:

| Service  | Host port | Image / build         | Notes                                            |
| -------- | --------- | --------------------- | ------------------------------------------------ |
| postgres | 5432      | `postgres:16-alpine`  | named volume `postgres_data`; healthchecked      |
| backend  | 4000      | `./backend` (build)   | `env_file: ./backend/.env`; waits for healthy DB |
| frontend | 3000      | `./frontend` (build)  | `env_file: ./frontend/.env`; depends on backend  |
| adminer  | 8080      | `adminer` (official)  | depends on postgres; browse the DB at `:8080`    |

Postgres defaults: user `vms`, password `vms`, db `vms`. Match these in `backend/.env`'s `DATABASE_URL`.

```bash
docker compose up --build
```

Both app Dockerfiles run as non-root (`nextjs` / `nestjs` uid 1001) and use Node 20.11.0-alpine. Frontend uses Next.js standalone output (`output: "standalone"` in `next.config.ts`); the runner stage assembles `public/` and `.next/static` alongside `server.js`.

### Backend Dockerfile specifics

- **`deps` and `prod-deps` stages** both set npm fetch tuning before `npm ci` to tolerate flaky network pulls: `fetch-retries=5`, `fetch-retry-mintimeout=20000`, `fetch-retry-maxtimeout=120000`, `fetch-timeout=600000`.
- **`builder` stage** runs `npx prisma generate` after copying source so the generated client lands in `node_modules/.prisma/client` / `node_modules/@prisma/client`. `prisma/` is copied explicitly even though `COPY . .` already includes it.
- **`runner` stage** starts from `prod-deps` for runtime `node_modules`, then overlays from `builder`: `node_modules/.prisma`, `node_modules/@prisma/client` (generated client), `node_modules/prisma` + `node_modules/.bin/prisma` (CLI — needed because `prisma` is a devDep and isn't in `prod-deps`), and the `prisma/` folder (schema + migrations).
- The image's `ENTRYPOINT` is `/usr/local/bin/docker-entrypoint.sh`. There is no `CMD` — the script execs `node dist/main.js` itself.

### Entrypoint behavior

`backend/docker-entrypoint.sh`:

1. Requires `DATABASE_URL` to be set; parses host/port out of the `postgresql://...` URL with POSIX shell expansion (no extra deps).
2. Polls the DB with a small `node -e` TCP probe (2 s connect timeout) once per second, up to 60 attempts.
3. Runs `npx prisma migrate deploy` against the running DB.
4. `exec node dist/main.js` so Node becomes PID 1 and signals propagate.

Consequence: every `docker compose up` ends with the schema applied automatically; no manual migrate step required.

## Terraform (`terraform/`)

Provisions the full VMS stack in AWS (region from `var.region`, default `us-east-1`).

**Network**
- VPC `10.0.0.0/16`, internet gateway, public route table.
- Two public subnets in different AZs: `10.0.1.0/24` (`public`) and `10.0.2.0/24` (`public_b`). The second subnet exists because `aws_db_subnet_group` requires ≥2 AZs even though only `public` actually hosts EC2 workloads.

**Security groups** (all egress open)
- `frontend` — inbound `80`, `443`, `22` from `0.0.0.0/0`.
- `backend` — inbound `4000`, `22` from `0.0.0.0/0`.
- `rds` — inbound `5432` only from the `backend` SG.

**EC2 (both `t2.micro`, latest Canonical Ubuntu 22.04, in subnet `public`)**
- `frontend` — `user_data` installs Node 20, clones the `develop` branch into `/opt/vms`, builds the frontend, runs the Next.js standalone server on port 80.
- `backend` — `user_data` installs Node 20, clones `develop` into `/opt/vms`, builds the backend, exports `DATABASE_URL` from the RDS endpoint, and runs `node dist/main.js` on port 4000 via `nohup`. `depends_on = [aws_db_instance.main]` so it doesn't start until RDS is ready.

Note: the EC2 backend currently does **not** run `prisma migrate deploy` on its own. Auto-migration is a Docker-image behaviour only. If/when you containerise the EC2 backend (or move to ECS/Fargate), the same self-migrating entrypoint kicks in. Until then, run `npx prisma migrate deploy` manually against the RDS endpoint after `terraform apply` or extend the `user_data` to do it.

**RDS**
- `aws_db_instance.main` — Postgres 16, `db.t3.micro`, 20 GiB gp3, `db_name=vmsdb`, `username=vmsuser`, password from `random_password.db` (32-char alphanumeric — special chars excluded so the URL and bash interpolation in `user_data` stay clean), `publicly_accessible=false`, `skip_final_snapshot=true`.
- `aws_db_subnet_group.main` spans both public subnets.

**Providers, variables, outputs**
- Providers: `hashicorp/aws ~> 5.0`, `hashicorp/random ~> 3.5`.
- Variables (`variables.tf`): `region` (`us-east-1`), `instance_type` (`t2.micro`), `project_name` (`vms`), `key_name` (`vms-key`).
- Outputs (`outputs.tf`): `public_ip` (frontend), `backend_public_ip`, `rds_endpoint`.

**Prerequisites before `terraform apply`**
- AWS credentials configured (env vars or `~/.aws/credentials`).
- An EC2 key pair named `vms-key` (or whatever you set `-var key_name=…` to) must already exist in the target region — Terraform does not create it.
- The GitHub repo must be reachable without auth for `user_data` to clone successfully; otherwise the build step fails silently and the instance will not serve.

State is local (no remote backend configured). `terraform/.gitignore` excludes `.terraform/`, `terraform.tfstate`, `terraform.tfstate.backup`, and `*.tfvars`. Because `random_password.db.result` lives in state, switch to an encrypted remote backend before anyone else touches the state file.

Both EC2 user_data scripts use `nohup`, not systemd — fine for a smoke test, not for anything durable. Add systemd units if you need restart-on-reboot.

## CI (`.github/workflows/ci.yml`)

Triggers on push and PR to `develop`, `staging`, `main`. Two parallel jobs on `ubuntu-latest`, Node 20.11.0, with npm cache keyed off each app's lockfile:

1. **frontend** — `npm ci` → `npm run lint` → `npm run build`
2. **backend** — `npm ci` → `npm run lint:check` → `npm run build`
