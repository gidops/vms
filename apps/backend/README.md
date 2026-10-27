# @vms/backend

**Who this is for:** developers working on the API. **What you'll learn:** where
things are and the commands you need most.

NestJS modular-monolith backend for the AATC Visitor Management System. It is
part of a Turborepo monorepo: run commands from the repo root. Setup is in the
[root README](../../README.md).

```bash
npm run start:dev -w @vms/backend      # dev server, http://localhost:4000
npm run build     -w @vms/backend
npm run test      -w @vms/backend      # unit tests + coverage gate
npm run test:e2e  -w @vms/backend      # e2e tests (needs a test database)
cd apps/backend && npx prisma migrate dev --name <name>   # new migration
```

Key areas:

- `src/modules/`: feature modules (visits, alerts, inbox, insights, desk-qr,
  rfid-cards, …). See [architecture.md](../../docs/architecture.md#modules).
- `src/shared/`: config, logging, auth and RBAC, events/outbox, audit, i18n,
  storage.
- `prisma/`: database schema and migrations.
- `src/scripts/` and `scripts/`: one-off imports (see
  [operations.md](../../docs/operations.md)).

API reference: [api.md](../../docs/api.md).
