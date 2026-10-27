# Architecture

**Who this is for:** developers joining the project. **What you'll learn:** how
the code is organised, how a request travels through the system, and the few
patterns (outbox, RBAC, audit) that every change must respect.

The VMS is one repository holding a backend API (NestJS), a web frontend
(Next.js) and shared packages. For how it runs on servers, see
[infrastructure.md](./infrastructure.md).

## Monorepo

The repo is a **monorepo**: several apps and libraries in one Git repository,
installed with one `npm install`. **Turborepo** runs tasks (build, test, lint)
across all of them in the right order; for example `@vms/contracts` builds before
the apps that use it.

```
apps/
  backend/         # NestJS API (modular monolith)
  frontend/        # Next.js web app (App Router)
packages/
  contracts/       # @vms/contracts: zod schemas, types, permission and role names
  ui/              # @vms/ui: component library + Storybook
  tokens/          # @vms/tokens: design tokens (colours, type, spacing) for Tailwind v4
  config/          # @vms/config: shared ESLint / TypeScript presets
```

Internal packages are consumed as TypeScript source (Next.js
`transpilePackages`), so relative imports inside `packages/*` have **no file
extension** (the Turbopack bundler does not rewrite `.js` to `.ts`).
`@vms/contracts` also ships a built `dist/` because the backend imports it
without a bundler. **After editing a contract, run `npx turbo run build`** or the
backend sees stale types.

**Contracts first.** `@vms/contracts` is the single source of truth for request
and response shapes, enums, permission keys and role names. Backend validation
and the frontend's types both come from it. When changing an API, change the
contract first.

## How a request flows

Example: the Security Manager presses **Approve**.

1. **Browser.** The React screen calls a hook in the frontend **data layer**
   (`apps/frontend/data/visits/`). The data layer is the only code that calls
   `fetch`; its HTTP client (`data/http/client.ts`) adds the access token, a
   correlation id (`x-correlation-id`) and the user's language (`x-locale`), and
   refreshes the token on a 401.
2. **Guards.** The request reaches the backend. Two global guards run first:
   `JwtAuthGuard` checks the token, `PermissionsGuard` checks the route's
   required permission (here `visit:approve`).
3. **Controller.** `visits.controller.ts` validates the body against the zod
   contract and calls a service.
4. **Service + transaction.** `moderation.service.ts` opens one database
   transaction. Inside it, it updates the `Visit` row **and** appends a
   `visit.approved` event to the `OutboxEvent` table. Both are saved, or
   neither is.
5. **Relay.** A background loop, the `OutboxRelay`, picks up new outbox rows
   every couple of seconds and publishes them on an in-process event bus.
6. **Listeners.** Anything interested reacts: the `AuditListener` writes an
   audit row; the `NotificationListener` queues the invite email/SMS/WhatsApp to
   the guest and an in-app note to the host.

The HTTP response returns after step 4. Steps 5 and 6 happen a moment later and
never slow down or break the user's request.

## Backend: modular monolith

A **modular monolith** is one deployable app split into feature modules with
clear boundaries, so a module could later become its own service.

Each module has a controller (HTTP routes) and one or more services (business
logic). Services use Prisma (the database library) directly; writes that change
state go through `TransactionManager.run` and `EventPublisher.publish(tx, …)`.

```
apps/backend/src/
  app.controller.ts   # GET /health (public, reports DB connectivity)
  shared/
    config/      # env validation with zod; the app refuses to start on bad config
    logging/     # pino structured logs + correlation ids (nestjs-cls)
    crypto/      # AES-256-GCM encryption for personal data (e.g. visitor phone)
    events/      # domain events, EventPublisher → outbox, TransactionManager, OutboxRelay
    audit/       # AuditListener, SecurityAuditService, optional Seq mirror
    auth/        # login, JWT, refresh-token rotation, RBAC guards, role/permission seeder
    i18n/        # backend translations (errors, emails, SMS) in en/fr/ar
    rate-limit/  # per-IP / per-token limits for the public self-registration form
    storage/     # S3 presigned uploads (avatars, access-card photos)
    common/      # validation pipe, error filter, CSV and WAT date helpers
  modules/       # feature modules, listed below
  scripts/       # import-v1-desk-qr.ts (one-off)
apps/backend/scripts/migrate-legacy.ts   # one-off import of the old system's data
apps/backend/prisma/                     # schema.prisma + migrations
```

### Modules

| Module          | What it does                                                                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `identity`      | Users, own profile and avatar, sessions, user admin, role list, host directory.                                                                                                                                                                                                                  |
| `visits`        | The core: create invites and walk-ins, read, edit, cancel, approve/deny/flag/request info, check-in/out, rating, export, evacuation roll, dashboard counts, delivery status. Split into `authoring`, `read`, `moderation`, `access`, `dashboard`, `export`, `evacuation`, `deliveries` services. |
| `alerts`        | Alert detail and status changes (resolve / dismiss lifts the visit's hold).                                                                                                                                                                                                                      |
| `inbox`         | The unified **Requests & Alerts** feed and unread counts.                                                                                                                                                                                                                                        |
| `notes`         | Free-text notes on a visit or alert.                                                                                                                                                                                                                                                             |
| `notifications` | Email, SMS, WhatsApp and in-app messages. See [notifications.md](./notifications.md).                                                                                                                                                                                                            |
| `staff`         | Staff home screen counts and activity feed.                                                                                                                                                                                                                                                      |
| `insights`      | The Insights page: overview, history, visitor directory, analytics.                                                                                                                                                                                                                              |
| `consent`       | Email opt-in list: view, export, withdraw, grant.                                                                                                                                                                                                                                                |
| `desk-qr`       | The walk-in QR: admin side (create, rotate, disable, print) and the public self-registration form with emailed 6-digit code.                                                                                                                                                                     |
| `access-cards`  | The pool of **shared physical badges** handed out at check-in and returned at check-out (`AccessCard` table).                                                                                                                                                                                    |
| `rfid-cards`    | **Personalised RFID cards** assigned to one visitor for a validity period, printed with a photo. Shown in the UI as **Operations → Access cards** (`RfidCard`, `RfidCardAssignment` tables).                                                                                                     |
| `audit-trail`   | Read and export the audit log (Operations → Audit trail).                                                                                                                                                                                                                                        |

> **Naming trap.** The backend module `access-cards` is the check-in badge
> pool. The UI screen called "Access cards" is backed by the `rfid-cards`
> module. Keep this in mind when searching the code.

### Event-driven foundation (transactional outbox)

An **outbox** is a database table where events are saved in the same
transaction as the change they describe, then delivered later. This guarantees
that an event is published if and only if the change was committed.

```
Service ─ tx ─▶ update rows  +  append event to OutboxEvent      (one transaction)
OutboxRelay (polls every OUTBOX_POLL_INTERVAL_MS, default 2000) ─▶ EventEmitter2 ─▶ listeners
```

- Domain code never publishes to the bus directly; it only calls
  `EventPublisher.publish(tx, …)`.
- The relay is the only component that knows the transport. Moving to a message
  broker such as NATS later is a relay-only change.
- Event metadata carries the correlation id, the acting user, IP, user agent and
  locale, captured from the request.

### Auth and RBAC

**RBAC** (role-based access control) means users get roles, roles bundle
**permissions** (`resource:action` keys such as `visit:approve`), and each route
requires permissions.

- **Provider-agnostic login.** `AuthService` depends on a
  `CredentialAuthProvider` interface. `LocalAuthProvider` (email + password,
  argon2 hashing) is the only implementation today; an SSO provider (e.g. Okta)
  can be added without touching controllers or guards.
- **Tokens.** A short-lived **JWT access token** carries the user's roles and
  the active role's permissions, so permission checks need no database lookup.
  An opaque **refresh token** gets a new access token. Refresh tokens are stored
  as SHA-256 hashes and grouped in a rotation `family`. Each refresh marks the
  old token used; **reusing a used token revokes the whole family** (theft
  defence).
- **Active role.** A user can hold several roles but acts as one at a time
  (`POST /auth/switch-role`). Add-on roles (`VMC_ADMIN`, `READ_ADMIN`) are merged
  into their base role and are never active on their own.
- **Guards.** Global `JwtAuthGuard` (opt out with `@Public()`) and
  `PermissionsGuard` (`@RequirePermissions(...)` needs all listed,
  `@RequireAnyPermission(...)` needs one). Ownership rules (e.g. staff only see
  visits they created or host) are enforced inside services.
- **Seeding.** On every boot, `shared/auth/seeder.service.ts` creates the
  permission catalogue, the roles and their permissions (`ROLE_DEFS`), and the
  badge pool. No user is seeded: the first System Admin is created through
  `/signup`, which locks itself once any user exists. Demo visits are seeded
  only when `SEED_DEMO_DATA=true`.

Role-to-permission mapping: see `ROLE_DEFS` in the seeder; a plain-language
version is in the [user guide](./user-guide.md#roles).

### Audit and observability

- **Audit is fed by the event stream.** One `AuditListener` (`@OnEvent('**')`)
  writes an append-only `AuditLog` row for every domain event. Business code
  never writes audit rows directly. Security events that have no business
  transaction (failed login, logout, token refresh, refresh-token reuse,
  permission denied, role switch, blocked signup) go through
  `SecurityAuditService`.
- **Logs.** `nestjs-pino` writes structured JSON logs. A **correlation id**
  (from the `x-correlation-id` header, or generated) is stamped on every log
  line and event, so one request can be traced end to end. Sensitive fields are
  redacted.
- **Seq mirror.** When `SEQ_URL` is set, audit events are also sent to
  [Seq](https://datalust.co/seq), a log search tool. Postgres `AuditLog` remains
  the system of record; Seq is best effort.
- **Errors.** A global filter returns RFC 7807-style problem responses
  (`type`, `title`, `status`, `detail`), translated to the caller's language,
  and logs 5xx errors with the correlation id.

### Data model (Prisma + PostgreSQL 16)

27 models in `apps/backend/prisma/schema.prisma`:

- **Identity, auth, audit:** `User`, `Role`, `Permission`, `RolePermission`,
  `UserRole`, `Session`, `RefreshToken`, `AuditLog`.
- **Visits:** `Visitor`, `Host`, `Visit`, `Invitation`, `Pass`, `Rating`,
  `Alert`, `Note`, `GateEvent`, `ShiftAttendance`.
- **Badges and cards:** `AccessCard` (badge pool), `RfidCard`,
  `RfidCardAssignment`.
- **Messaging and consent:** `Notification`, `CommsConsentEvent`.
- **Walk-in QR:** `DeskQr`, `DeskQrRegistration`.
- **Events:** `OutboxEvent`.

Enums mirror `@vms/contracts`. Personal fields such as `Visitor.phone` are
encrypted with `ENCRYPTION_KEY`.

## Frontend: layered

Layers depend downward only: screens → data → shared.

```
apps/frontend/
  app/[locale]/   # screens (App Router). One folder per route; shared pieces in _components/
  data/           # the only place that calls fetch: http/client.ts + one folder per domain
                  #   (visits, inbox, insights, rfid-cards, …) with TanStack Query hooks
  shared/         # AuthContext, RouteGuard, PermissionGate, providers, small helpers
  i18n/ messages/ # next-intl routing + en/fr/ar text catalogs
```

Routes: `/` (sign-in), `/signup`, `/forgot-password`, `/dashboard` and
`/requests` (VMC), `/staff` (+ `/visits`, `/updates`), `/admin` (+ `/requests`,
`/users`, `/activity`), `/admin/v2` (+ `/approvals`, `/requests`, `/users`),
`/gate` (+ `/evacuation`), `/insights`, `/operations`, `/settings`, and the
public self-registration form `/r/[token]`. See the
[user guide](./user-guide.md) for what each screen does and
[admin-console-v2.md](./admin-console-v2.md) for the two admin consoles.

Server data is cached with **TanStack Query**. Auth is a React context that
holds tokens and refreshes them silently. Screens hide buttons the user lacks
permission for, but the backend is what enforces it.

### Languages and right-to-left

next-intl with `[locale]` routing: English is the default (no prefix), French
under `/fr`, Arabic under `/ar`. Arabic renders right-to-left (`dir="rtl"`), so
components use **logical CSS properties** (`ms`/`me`, `start`/`end` instead of
left/right) and the layout flips automatically. The backend translates its own
errors and messages from the `x-locale` header.

## Design system

`@vms/tokens` defines colours, type and spacing as **semantic tokens** (e.g.
`bg-surface`, `text-fg-muted`) with light and dark values. `@vms/ui` builds
components on Radix UI / React Aria, styled with tailwind-variants. See
[design-system.md](./design-system.md).

## Deployment

Locally: Docker Compose. In AWS: one EC2 host runs both containers behind an
HTTPS load balancer, with RDS PostgreSQL. See
[infrastructure.md](./infrastructure.md) and [operations.md](./operations.md).
