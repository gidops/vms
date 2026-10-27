# Developer guide

How to run the project and what to know before changing it. For how the code
fits together in depth, read [architecture.md](./architecture.md) afterwards.

## Quick start

You need Node 20.11.0 (`nvm use`), npm 10+, and Docker running.

1. Install and build (build once so the backend can find the shared contracts):
   ```bash
   nvm use
   npm install
   npm run build
   ```
2. Create your env files (they already have working local values):
   ```bash
   cp -n apps/backend/.env.example apps/backend/.env
   cp -n apps/frontend/.env.example apps/frontend/.env
   ```
3. Start the database and create the tables:
   ```bash
   npm run db:start
   npm run db:migrate
   ```
4. Run the apps, each in its own terminal:
   ```bash
   npm run backend     # http://localhost:4000
   npm run frontend    # http://localhost:3000
   ```
5. Open <http://localhost:3000/signup> and create the first account (no user
   is seeded; signup closes once one exists).

Want demo data? Set `SEED_DEMO_DATA=true` in `apps/backend/.env` and restart
the backend.

| Service        | URL                                                                 |
| -------------- | ------------------------------------------------------------------- |
| App            | <http://localhost:3000> (`/fr`, `/ar` for other languages)          |
| Backend health | <http://localhost:4000/health>                                      |
| Adminer (DB)   | <http://localhost:8080> — server `postgres`, user/password/db `vms` |
| Seq (logs)     | <http://localhost:8081>                                             |
| Storybook      | `npm run storybook -w @vms/ui` → <http://localhost:6006>            |

## Everyday commands

```bash
npm run build                              # rebuild (do this after editing packages/contracts)
npx turbo run lint:check typecheck test    # what CI checks
npm run format                             # format code

npm run test -w @vms/backend               # backend tests
npm run test -w @vms/frontend              # frontend tests
```

New database migration (inside `apps/backend`):

```bash
npx prisma migrate dev --name <what-changed>
```

More test and quality commands: [ci-quality.md](./ci-quality.md).

## Where things are

| Folder                        | What's in it                                            |
| ----------------------------- | ------------------------------------------------------- |
| `apps/backend/src/modules/`   | One folder per feature (visits, alerts, users, …)       |
| `apps/backend/src/shared/`    | Login and permissions, events, audit, config, logging   |
| `apps/backend/prisma/`        | Database schema and migrations                          |
| `apps/frontend/app/[locale]/` | One folder per screen                                   |
| `apps/frontend/data/`         | All API calls and data hooks                            |
| `apps/frontend/messages/`     | English, French and Arabic text                         |
| `packages/contracts/`         | Shapes, roles and permissions shared by both apps       |
| `packages/ui/`                | Shared components (see them in Storybook)               |
| `terraform/`, `vms-deploy.sh` | AWS setup and deploy ([operations.md](./operations.md)) |

## Before you change something

- **Shared shapes first.** If a request or response changes, edit
  `packages/contracts` first, then run `npm run build`.
- **Backend:** wrap a change and its event in one transaction
  (`txm.run` + `events.publish`); never write audit rows yourself. Every route
  needs `@RequirePermissions(...)` or `@Public()`; a test fails otherwise.
- **Dates** shown to people use West Africa Time: use `shared/common/wat.ts`.
- **Frontend:** API calls go in `data/`, not in screens. Put every visible text
  in all three `messages/*.json` files. Use `ms-`/`me-`/`text-start` instead of
  left/right so Arabic works.
- **Tests** go next to the file they test. CI blocks a merge if they fail.
- **Comments** only say _why_, briefly.

The reasoning behind these rules is in [architecture.md](./architecture.md).

## Branches

Work on `develop`. `main` is production, `staging` is pre-production. GitHub
Actions must pass before merging into `main` or `staging`; Jenkins deploys from
those two branches only.

## Unfinished work

- **Two admin consoles.** Admins land on the old `/admin`; the new one is
  `/admin/v2`. To switch: move `admin/v2/*` up to `admin/*` (first move
  `admin/_components/users/UserDialogs` and `admin/_components/pendingApprovals`,
  which v2 still uses), delete the old admin components and pages, and pick one
  `?layout=` option on v2 Recent Activity and Users.
- The thank-you message links to `/rating/<visitId>`, but that page doesn't
  exist yet.
- Plain VMC users can't reach the email consent screen without the VMC Admin
  add-on.
- `GET /visits/dashboard/traffic` is no longer used by the frontend.
- The `Invitation` and `ShiftAttendance` tables are unused; drop them once
  production confirms they're empty.
- `shared/auth/visit-scope.ts` has a temporary fallback for old login tokens;
  remove it in the next release.
- The refresh token sits in `localStorage`; moving it to an httpOnly cookie is
  the planned hardening.
