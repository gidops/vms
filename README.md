# AATC Visitor Management System (VMS)

Enterprise visitor management for a diplomatic/banking environment — a typed
full‑stack **Turborepo** monorepo with a NestJS modular‑monolith backend and a
Next.js (App Router) frontend, sharing zod contracts and a Storybook‑backed
design system. Security‑first (RBAC, audit logging, refresh‑token rotation),
event‑driven (transactional outbox), observable (structured logs + correlation
IDs), and internationalized (English / French / Arabic + RTL).

## Tech stack

Next.js 16 · NestJS 11 · Prisma 6 + PostgreSQL 16 · Tailwind v4 · Radix UI /
React Aria · Storybook 9 · zod · TanStack Query · Turborepo + npm workspaces ·
Docker · Terraform (AWS) · GitHub Actions.

## Prerequisites

- **Node 20.x** (`nvm use` reads `20.11.0` from `.nvmrc`), npm ≥ 10
- **Docker Desktop** running (used for PostgreSQL)

## Installation

```bash
# 1. Clone
git clone https://github.com/gidops/vms.git
cd vms

# 2. Install all workspaces (single root install)
nvm use
npm install

# 3. Build shared packages once (generates @vms/contracts dist, etc.)
npx turbo run build
```

`.env` files for local dev are already provided (`apps/backend/.env`,
`apps/frontend/.env`) and are gitignored.

## Run the project

DB in Docker, apps with hot reload:

```bash
# Start PostgreSQL (+ Adminer DB browser)
docker compose up -d postgres adminer seq

# Apply database migrations
cd apps/backend && npx prisma migrate deploy && cd ../..

# Backend  (terminal 1) → http://localhost:4000   (seeds an admin user on first boot)
npm run start:dev -w @vms/backend

# Frontend (terminal 2) → http://localhost:3000
npm run dev -w @vms/frontend
```

Open <http://localhost:3000> and sign in:

| Email | Password |
| --- | --- |
| `admin@aatc.org` | `Passw0rd!` |

> Prefer one command? `docker compose up --build` runs the whole stack in Docker —
> first set `DATABASE_URL`'s host to `postgres` in `apps/backend/.env`. See the
> [runbook](./docs/runbook.md).

### URLs

| Service | URL |
| --- | --- |
| Frontend (login) | <http://localhost:3000/> · `/fr`, `/ar` for French/Arabic (RTL) |
| Dashboard | <http://localhost:3000/dashboard> |
| Backend health | <http://localhost:4000/health> |
| Adminer | <http://localhost:8080> (System **PostgreSQL**, server **postgres**, user/pass/db **vms/vms/vms**) |
| Storybook | `npm run storybook -w @vms/ui` |

## Documentation

Detailed docs live in [`docs/`](./docs/README.md):

- [Architecture](./docs/architecture.md) — monorepo, modular monolith, events/outbox, auth/RBAC, observability, data model
- [Runbook](./docs/runbook.md) — running locally & in Docker, env vars, commands, migrations, deployment, troubleshooting
- [API](./docs/api.md) — endpoints, auth flow, request/response shapes
- [Design system](./docs/design-system.md) — tokens, components, Storybook, dark mode & RTL

(`CLAUDE.md` is the repo guide for AI assistants.)

## Repository layout

```
apps/
  frontend/        # Next.js app (login + dashboard, i18n, auth)
  backend/         # NestJS modular monolith (auth, events, audit, …)
packages/
  contracts/       # @vms/contracts — shared zod schemas/types
  ui/              # @vms/ui — design system + Storybook
  tokens/          # @vms/tokens — Tailwind v4 design tokens
  config/          # @vms/config — shared eslint/tsconfig presets
terraform/         # AWS infrastructure
docs/              # documentation
```

## Common commands

```bash
npx turbo run build              # build everything
npx turbo run lint:check typecheck test   # the CI gates
npx turbo run dev                # frontend dev server
npm run <script> -w @vms/backend # scope to one workspace
```

## Branches

`main` (production) · `staging` (pre‑prod) · `develop` (active development). CI
runs on push/PR to all three.
