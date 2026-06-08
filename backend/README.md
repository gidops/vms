# VMS Backend

The NestJS REST API for the [AATC Visitor Management System](../README.md).
Written in TypeScript, it persists visitor records to PostgreSQL via Prisma and
exposes a DB-aware health endpoint.

> **npm only.** Use npm for every command — not yarn, pnpm, or bun.

## Prerequisites

- Node `20.11.0` (run `nvm use` from the repo root to pick it up from `.nvmrc`)
- A reachable PostgreSQL 16 database. The simplest path is Docker Compose from
  the repo root, which brings up Postgres, the backend, the frontend, and
  Adminer together — see the [root README](../README.md).

## Local development

```bash
cp .env.example .env     # then edit values as needed
npm install
npm run start:dev        # watch mode
```

Nest listens on `process.env.PORT ?? 3000` (`src/main.ts`). When running
directly alongside the frontend, set `PORT=4000` in `.env` so it doesn't clash
with the frontend's `3000`. In Docker the backend's `PORT` is `4000`.

## Commands

| Task                         | Command                                |
| ---------------------------- | -------------------------------------- |
| Dev server (watch)           | `npm run start:dev`                    |
| Start                        | `npm start`                            |
| Start prod                   | `npm run start:prod`                   |
| Build                        | `npm run build`                        |
| Lint (auto-fix)              | `npm run lint`                         |
| Lint (CI, no fix)            | `npm run lint:check`                   |
| Unit tests                   | `npm test`                             |
| Single test file             | `npm test -- path/to/file.spec.ts`     |
| E2E tests                    | `npm run test:e2e`                     |
| Coverage                     | `npm run test:cov`                     |
| Prisma — generate            | `npx prisma generate`                  |
| Prisma — migrate (dev)       | `npx prisma migrate dev --name <name>` |
| Prisma — migrate (prod / CI) | `npx prisma migrate deploy`            |
| Prisma — Studio              | `npx prisma studio`                    |

CI runs `lint:check` (no `--fix`), so any lint finding fails the build. Leave the
`lint` script for local auto-fix.

## Database & Prisma

The backend uses **Prisma 6** (`prisma-client-js` generator) against PostgreSQL
16.

- **Schema:** `prisma/schema.prisma` — datasource `postgresql` with
  `url = env("DATABASE_URL")`. The generated client is imported as
  `import { PrismaClient } from '@prisma/client'`.
- **Model:** `Visitor` — `id`, `fullName`, `email` (unique), `phone?`,
  `hostName`, `purpose`, `checkIn` (`@default(now())`), `checkOut?`,
  `createdAt`, `updatedAt`.
- **Migrations:** `prisma/migrations/` holds the SQL migration history.
- **`PrismaService`** (`src/prisma/prisma.service.ts`) extends `PrismaClient` and
  binds `$connect` / `$disconnect` to the Nest lifecycle. **`PrismaModule`**
  (`src/prisma/prisma.module.ts`) provides and exports it. Inject it with
  `constructor(private readonly prisma: PrismaService) {}` and call
  `this.prisma.visitor.findMany()` etc.

### Migrations locally

For schema changes during development:

```bash
npx prisma migrate dev --name <name>
```

When running the Prisma CLI from your host, point `DATABASE_URL` at `localhost`
(see the env note below).

### Auto-migrate on startup (containers)

The backend Docker image ships with a `docker-entrypoint.sh` that, on every
container start:

1. waits for the database to be reachable (a short TCP probe, retried);
2. runs `npx prisma migrate deploy` to apply pending migrations;
3. execs `node dist/main.js`.

So any containerised start (Docker Compose, or any orchestrator running the
backend image) ends with the schema matching `prisma/schema.prisma` — no manual
migration step. When running the backend directly with npm, apply migrations
yourself with `npx prisma migrate deploy` (or `migrate dev`).

## Environment variables

`.env` is gitignored; only `.env.example` is checked in. Copy it before running:

```bash
cp .env.example .env
```

- `DATABASE_URL` — Postgres connection string.
- `JWT_SECRET`, `JWT_EXPIRES_IN` — JWT signing config.
- `PORT` — listen port (`4000` in Docker; any free port locally).
- `NODE_ENV`.

> **Database host gotcha.** Inside Docker Compose, `DATABASE_URL` must use the
> service hostname `postgres`
> (e.g. `postgresql://vms:vms@postgres:5432/vms`). When running the Prisma CLI
> on your host, switch the host to `localhost`.

## Health check

`GET /health` (handler on `AppController`) pings the database with
``prisma.$queryRaw`SELECT 1` `` inside a try/catch:

- Success: `{ status: "ok", database: "connected", timestamp: <ISO> }`
- Failure: `{ status: "ok", database: "disconnected", error: <message>, timestamp: <ISO> }`

`status` is intentionally `"ok"` in both branches — if you wire this into an
external probe that must alert on DB outages, key off `database` (or change the
failure branch's status).

> **Testing note.** Any spec that constructs a controller/provider depending on
> `PrismaService` must register a mock provider. See `src/app.controller.spec.ts`,
> which registers
> `{ provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue([...]) } }`.

## How it fits with the frontend

The Next.js frontend calls this API at its `NEXT_PUBLIC_API_BASE_URL`. Runtime
request flow:

```
Browser → Next.js (3000) → NestJS (4000) → PrismaService → Postgres (5432)
```

See the [root README](../README.md) for the full-stack Docker Compose
quickstart.
