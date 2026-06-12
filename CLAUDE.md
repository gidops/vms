# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AATC Visitor Management System (VMS) — enterprise visitor management for a diplomatic/banking environment. A typed full-stack **Turborepo** monorepo: a NestJS modular-monolith backend and a Next.js (App Router) frontend sharing zod contracts and a Storybook-backed design system. Security-first (RBAC, audit logging, refresh-token rotation), event-driven (transactional outbox), observable (structured logs + correlation IDs), and internationalized (English / French / Arabic + RTL).

> **Deep docs live in [`docs/`](./docs/README.md).** This file is the orientation map and gotchas list; `docs/` is the authoritative reference. When a section here says "see docs/…", read it before doing non-trivial work in that area.
> - [`docs/architecture.md`](./docs/architecture.md) — monorepo, modular monolith & layering, events/outbox, auth/RBAC, observability, data model, frontend layering
> - [`docs/runbook.md`](./docs/runbook.md) — running locally & in Docker, env vars, migrations, deployment, troubleshooting
> - [`docs/api.md`](./docs/api.md) — endpoints, auth flow, request/response shapes, correlation IDs
> - [`docs/design-system.md`](./docs/design-system.md) — tokens, component catalogue, Storybook, dark mode & RTL

## Stack

- **Frontend:** Next.js 16 (TypeScript, App Router), React 19, Tailwind **v4** (CSS-first `@theme`), next-intl (i18n + RTL), TanStack Query. Standalone output.
- **Backend:** NestJS 11 (TypeScript) modular monolith — argon2 auth, JWT + opaque refresh tokens, RBAC, transactional outbox (EventEmitter2), audit log, pino logging with correlation IDs, AES-256-GCM column encryption.
- **Shared contracts:** `@vms/contracts` — zod schemas + types (dual ESM/CJS build via tsup).
- **Design system:** `@vms/ui` (Radix UI / React Aria + tailwind-variants, Storybook 9) and `@vms/tokens` (Tailwind v4 design tokens).
- **ORM / DB:** Prisma `^6.19.3` + PostgreSQL 16.
- **Monorepo:** Turborepo + npm workspaces. `apps/*` + `packages/*`, single root lockfile + hoisted `node_modules`.
- **Infra:** Docker Compose (local), Terraform/AWS (cloud, ECR-based deploy). CI: GitHub Actions.

## Monorepo workspaces

```
apps/
  frontend/   @vms/frontend   Next.js app (login + dashboard, i18n, auth)
  backend/    @vms/backend    NestJS modular monolith
packages/
  contracts/  @vms/contracts  shared zod schemas/types (dual ESM/CJS via tsup)
  ui/         @vms/ui         design system + Storybook
  tokens/     @vms/tokens     Tailwind v4 @theme design tokens
  config/     @vms/config     shared eslint/tsconfig presets
```

**Internal packages are consumed as TypeScript source** (`@vms/ui`, `@vms/tokens` via Next `transpilePackages` / Vite). Consequence: imports between/into those packages are **extensionless** (`./foundations/index`, not `.js`) — Turbopack/Vite do not rewrite `.js`→`.ts`. The exception is **`@vms/contracts`**, which also ships a built `dist` because the bundler-less NestJS backend imports it — its internal `index.ts` uses `.js` extensions (ESM). Match the convention of the package you're editing.

Run tasks from the repo root via Turbo (respects the dependency graph — e.g. `@vms/contracts` builds before its consumers), or scope to one workspace with `-w`:

```bash
npx turbo run build                                  # build all workspaces
npx turbo run lint:check typecheck build build-storybook test   # the full CI gate set
npm run <script> -w @vms/backend                     # single workspace
```

## Local quickstart

DB in Docker, apps with hot reload (matches the README):

```bash
nvm use                                              # Node 20.11.0 from .nvmrc
npm install                                          # single root install
npx turbo run build                                  # build shared packages (contracts dist, etc.)
docker compose up -d postgres adminer                # Postgres + Adminer
cd apps/backend && npx prisma migrate deploy && cd ../..
npm run start:dev -w @vms/backend                    # → http://localhost:4000 (seeds admin on first boot)
npm run dev -w @vms/frontend                         # → http://localhost:3000
```

`.env` files are gitignored; copies for local dev already exist in the repo. Sign in at <http://localhost:3000> with `admin@aatc.org` / `Passw0rd!` (seeded on first backend boot). Full-Docker alternative (`docker compose up --build`) requires switching `DATABASE_URL`'s host to `postgres` first — see [docs/runbook.md](./docs/runbook.md).

Locales: `/` (en, no prefix), `/fr`, `/ar` (RTL). Storybook: `npm run storybook -w @vms/ui` (port 6006).

## Commands

### Root (Turbo)

| Task | Command |
| --- | --- |
| Build all | `npx turbo run build` |
| Lint (CI, no fix) | `npx turbo run lint:check` |
| Typecheck | `npx turbo run typecheck` |
| Test | `npx turbo run test` |
| Build Storybook (CI gate) | `npx turbo run build-storybook` |
| Format | `npm run format` (prettier) |

### Frontend (`-w @vms/frontend`)

`dev` · `build` · `start` · `lint` / `lint:check` (eslint) · `typecheck` (`tsc --noEmit`). Dev server on `:3000`.

### Backend (`-w @vms/backend`)

`start:dev` (watch) · `start` · `start:prod` · `build` · `lint` (auto-fix) / `lint:check` (CI, no fix) · `typecheck` · `test` · `test:e2e` · `test:cov`. Single test file: `npm test -- path/to/file.spec.ts -w @vms/backend`.

Backend listens on `PORT` (zod-defaulted to **4000** in `env.schema.ts`; `apps/backend/src/main.ts`). Env is **validated at boot** — a missing/typo'd var fails fast with a readable message rather than crashing later.

Prisma: `npx prisma generate` · `migrate dev --name <name>` · `migrate deploy` (prod/CI) · `studio`. The backend `postinstall` runs `prisma generate` on every install.

### Design system (`-w @vms/ui`)

`storybook` (dev, :6006) · `build-storybook` (static, **a CI gate**) · `lint` / `lint:check` · `typecheck`.

## Backend architecture (modular monolith)

See [docs/architecture.md](./docs/architecture.md) for the full picture. Wired in `app.module.ts`: `ConfigModule`, `LoggingModule`, `PrismaModule`, `CryptoModule`, `EventsModule`, `AuditModule`, `IdentityModule`, `AuthModule`.

```
apps/backend/src/
  shared/
    config/    @nestjs/config + zod-validated env (env.schema.ts, fail-fast)
    logging/   nestjs-pino structured JSON + nestjs-cls correlation IDs
    crypto/    AES-256-GCM EncryptionService (PII / biometric refs)
    events/    domain-event, EventPublisher→outbox, TransactionManager, OutboxRelay
    audit/     AuditListener ('**') → append-only AuditLog
    auth/      provider-agnostic auth, JWT, refresh rotation, RBAC guards, seeder
    common/    zod validation pipe, RFC-7807 exception filter
  modules/
    identity/  users + GET /users/me
  app.controller.ts   GET / and GET /health (DB-aware)
```

Key invariants to respect when extending the backend:

- **Transactional outbox.** A use-case's state change **and** its domain event are appended to `OutboxEvent` in **one transaction** (`TransactionManager.run` + `EventPublisher.publish(tx, …)`). The polling `OutboxRelay` republishes onto the in-process EventEmitter2 bus. Don't emit domain events outside this path — handlers (audit, notifications) consume from the relay, and the relay is the only component that knows the transport (so a future swap to NATS is relay-only).
- **Audit is event-driven.** One `AuditListener` (`@OnEvent('**')`) writes an `AuditLog` row per domain event. Business code never calls the audit log directly.
- **Auth is provider-agnostic.** `AuthService` depends on a `CredentialAuthProvider` interface; `LocalAuthProvider` (email + argon2) is the only impl today. Short-lived JWT access token (claims include roles + permissions) + opaque refresh token stored as SHA-256 hash, grouped by rotation `family`; **reuse of a used refresh token revokes the whole family**. Routes: `POST /auth/login`, `/auth/refresh`, `/auth/logout`.
- **Authorization.** Global `JwtAuthGuard` (opt out with `@Public()`) + global `PermissionsGuard` (`@RequirePermissions('visit:approve')`). Permissions ride in the token, so checks need no per-request DB hit.
- **Errors / logging.** Global `AllExceptionsFilter` returns RFC-7807 problem responses; pino logs carry the correlation id from `x-correlation-id` (or generated). `main.ts` also wires helmet, CORS, and shutdown hooks.

### Prisma / data model

- **Schema:** `apps/backend/prisma/schema.prisma` — **20 models** across Identity/Auth/Audit (`User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `Session`, `RefreshToken`, `AuditLog`), Domain (`Visitor`, `Host`, `Visit`, `Invitation`, `Pass`, `AccessCard`, `Rating`, `Alert`, `GateEvent`, `ShiftAttendance`, `Notification`), and Events (`OutboxEvent`). Enums mirror `@vms/contracts`.
- **Migrations** (`apps/backend/prisma/migrations/`): `20260529110322_init_visitor`, `20260608105532_expand_domain_schema`.
- **PII columns** (`Visitor.phone`, `nationalId`, `ShiftAttendance.fingerprintTemplateRef`) are intended for column encryption via the crypto module — biometrics stored only as an external reference/hash, never raw.
- **PrismaService** extends `PrismaClient` and binds `$connect`/`$disconnect` to the Nest lifecycle; `PrismaModule` exports it. Generator output goes to the hoisted `node_modules/@prisma/client` — import `from '@prisma/client'`.
- **Tests:** any spec constructing a provider that depends on `PrismaService` must register a mock — see `apps/backend/src/app.controller.spec.ts`.

Pinned to Prisma `^6.19.3` deliberately: Prisma 7 needs Node ≥20.19, but the repo pins **20.11.0** via `.nvmrc`.

## Frontend architecture (layered)

```
apps/frontend/
  app/[locale]/   routing: login (/) + dashboard; <html lang dir>
  data/           http client (auth header + correlation id + refresh-on-401), api modules
  shared/         AuthContext (provider-agnostic), providers (TanStack Query), RouteGuard
  i18n/ + messages/   next-intl config + en/fr/ar catalogs
```

Dependencies point downward (Presentation → Data → Shared). **The `data/` layer is the sole owner of `fetch`** — UI consumes typed `@vms/contracts`, never raw backend shapes. Server state via TanStack Query; auth is a React context orchestrating tokens + silent refresh on 401.

- **i18n:** `middleware.ts` runs next-intl on all non-API/non-internal paths. `i18n/routing.ts` defines locales `["en","fr","ar"]`, `defaultLocale: "en"`, `localePrefix: "as-needed"` (en is unprefixed). `isRtl()` flags `ar`; components use **logical Tailwind properties** (`ms/me`, `ps/pe`, `start/end`, `text-start`) so layout flips for RTL.

## Design system (`@vms/ui` + `@vms/tokens`)

See [docs/design-system.md](./docs/design-system.md). Layered **foundations → primitives → components → patterns**, built on Radix UI / React Aria, styled with `tailwind-variants`. Every export has a Storybook story.

- **Tokens** (`@vms/tokens`): Tailwind v4 CSS-first `@theme`, two tiers — a primitive palette and **semantic tokens** (`bg-canvas`, `bg-surface`, `text-fg`, `bg-primary`, `success`/`warning`/`danger`/`info`, …). **Components reference semantic tokens only, never the raw palette.** Dark mode swaps semantic values via `[data-theme="dark"]` on `<html>`. Apps and Storybook both `@import "tailwindcss"; @import "@vms/tokens/theme.css";` so they render identically.
- **Conventions:** co-located `Component.tsx`, `Component.variants.ts`, `Component.stories.tsx`. Standardized variant axes: `intent`, `tone`, `size`. Status/lifecycle values come from `@vms/contracts` (e.g. `StatusBadge` maps `VisitStatus`) so the UI can't render a state the backend doesn't define.
- **Storybook 9** + `@storybook/react-vite`; addons **a11y** (axe per story) and **themes** (light/dark via `data-theme` + LTR/RTL via a `dir` toolbar toggle). `build-storybook` is a CI gate.

## Environment variables

`.env` files are gitignored (only `.env.example` checked in). Backend env is zod-validated (`apps/backend/src/shared/config/env.schema.ts`):

- `DATABASE_URL` (required) — in Docker Compose use host `postgres`; for host-run Prisma CLI use `localhost`.
- `JWT_SECRET` (required), `JWT_EXPIRES_IN` (default `1h`)
- `ENCRYPTION_KEY` — base64 32-byte key for column encryption; derived from `JWT_SECRET` in dev if absent
- `PORT` (default 4000), `NODE_ENV`, `LOG_LEVEL` (default `info`), `OUTBOX_POLL_INTERVAL_MS` (default 2000)

Frontend: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_BASE_URL`.

## Health checks

- **Backend** `GET /health` pings the DB via ``prisma.$queryRaw`SELECT 1` `` and returns `{ status, database: "connected"|"disconnected", timestamp }`. `status` is intentionally `"ok"` in both branches — key external probes off `database`, not `status`.
- **Frontend** `GET /api/health` → `{ status: "ok", timestamp }` (`force-dynamic`).

## Docker

`docker-compose.yml` runs **postgres** (5432, healthchecked, volume `postgres_data`), **backend** (4000, waits for healthy DB), **frontend** (3000), **adminer** (8080). Postgres defaults user/pass/db `vms`. Both app images build with **repo root as context** (`dockerfile:` points at `apps/*/Dockerfile`) and use `turbo prune` for a focused workspace subset; both run non-root on Node 20.11.0-alpine.

The **backend entrypoint** (`apps/backend/docker-entrypoint.sh`) waits for the DB (TCP probe, 60×1s), runs `npx prisma migrate deploy`, then `exec node dist/main.js` (Node as PID 1). So every Compose start ends with the schema applied — no manual migrate step in containers. The runner image bundles the Prisma CLI + `prisma/` folder for this. The **frontend Dockerfile** bakes `NEXT_PUBLIC_API_BASE_URL` at build time via `ARG/ENV` (Next inlines public env at build).

## Terraform / deploy (`terraform/`)

Provisions the AWS stack (`var.region`, default `us-east-1`): `main.tf`, `ecr.tf`, `eip.tf`, `iam.tf`, `secrets.tf`, `provider.tf`, `variables.tf`, `outputs.tf`.

**Deploy model: prebuilt ECR images** (not clone-and-build). `t2.micro` OOMs building the Next.js + turbo image, so:
- `ecr.tf` — backend + frontend ECR repos. `iam.tf` — EC2 instance profile with ECR read-only. EC2 `user_data` does `docker login` + pull/run the prebuilt images at boot.
- `eip.tf` — a stable backend Elastic IP so the frontend image can **bake `NEXT_PUBLIC_API_BASE_URL` at build time**.
- `secrets.tf` — generates `JWT_SECRET` + 32-byte `ENCRYPTION_KEY`.
- Network: VPC `10.0.0.0/16`, two public subnets (2 AZs — RDS subnet group needs ≥2). SGs: frontend (80/443/22), backend (4000/22), rds (5432 from backend SG only). RDS Postgres 16 (`db.t3.micro`, private, password from `random_password`).

State is **local** (no remote backend); `random_password` result lives in state — switch to an encrypted remote backend before sharing state. An EC2 key pair named `vms-key` must already exist in the region (Terraform doesn't create it). See [docs/runbook.md](./docs/runbook.md) for the full deploy flow.

## CI (`.github/workflows/ci.yml`)

Triggers on push/PR to `develop`, `staging`, `main`. Two jobs on `ubuntu-latest`, Node 20.11.0:

1. **apps** — `npm ci` (root) → `turbo run lint:check` → `typecheck` → `build` → `build-storybook` → `test`. CI uses `lint:check` (no `--fix`), so any lint finding fails — leave the auto-fixing `lint` script alone for local use.
2. **terraform** — `terraform fmt -check` → `init -backend=false` → `validate`.

## Branches

`main` (production) · `staging` (pre-prod) · `develop` (active default working branch). CI runs on all three. `main`/`staging` may lag `develop`.
