# @vms/frontend

**Who this is for:** developers working on the web app. **What you'll learn:**
where things are and the commands you need most.

Next.js (App Router) frontend for the AATC Visitor Management System. It is part
of a Turborepo monorepo: run commands from the repo root. Setup is in the
[root README](../../README.md).

```bash
npm run dev      -w @vms/frontend      # dev server, http://localhost:3000
npm run build    -w @vms/frontend
npm run test     -w @vms/frontend      # Vitest unit tests
npm run test:cov -w @vms/frontend      # with coverage
```

Key areas:

- `app/[locale]/`: screens, one folder per route (see the
  [user guide](../../docs/user-guide.md) for what each does).
- `data/`: the only code that calls the API (`http/client.ts`) plus TanStack
  Query hooks per domain.
- `shared/`: auth context, route guard, providers.
- `i18n/` and `messages/`: English, French and Arabic text.

Components come from `@vms/ui` and design tokens from `@vms/tokens`; see
[design-system.md](../../docs/design-system.md). Layering rules are in
[architecture.md](../../docs/architecture.md#frontend-layered).
