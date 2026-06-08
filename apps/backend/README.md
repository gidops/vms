# @vms/backend

NestJS modular‑monolith backend for the AATC Visitor Management System.

This app is part of a Turborepo monorepo — **do not run commands from this folder
in isolation**. See the [root README](../../README.md) for setup, how to run the
stack, environment variables, and architecture.

Quick reference (from the repo root):

```bash
npm run start:dev -w @vms/backend      # dev server (http://localhost:4000)
npm run build      -w @vms/backend
npm test           -w @vms/backend
cd apps/backend && npx prisma migrate dev --name <name>
```

Key areas: `src/shared/` (config, logging, crypto, events/outbox, audit, auth,
common), `src/modules/identity/`, `prisma/` (schema + migrations).
