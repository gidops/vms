# Architecture

A typed full‑stack **Turborepo** monorepo: a NestJS modular‑monolith backend and
a Next.js frontend, sharing zod contracts and a Storybook‑backed design system.
Designed security‑first, event‑driven, and i18n‑ready.

## Monorepo

Turborepo + npm workspaces — one root `package.json`, one lockfile, one hoisted
`node_modules`. Tasks run from the root via Turbo and respect the dependency
graph (e.g. `@vms/contracts` builds before the apps that consume it).

```
apps/
  frontend/        # Next.js (App Router)
  backend/         # NestJS (modular monolith)
packages/
  contracts/       # @vms/contracts — zod schemas/types (dual ESM/CJS via tsup)
  ui/              # @vms/ui — design system + Storybook
  tokens/          # @vms/tokens — Tailwind v4 @theme tokens
  config/          # @vms/config — shared eslint/tsconfig presets
```

Internal packages are consumed as **TS source** (via Next `transpilePackages` and
Vite), so relative imports are **extensionless** (Turbopack does not rewrite
`.js`→`.ts`). `@vms/contracts` additionally ships a built `dist` because the
bundler‑less NestJS backend imports it.

## Backend — modular monolith

Layering (per module): **controllers → DTOs → use‑cases → domain + repository
ports ← persistence adapters**. The `application` layer depends on repository
interfaces, never on Prisma; the `domain` layer has no framework imports.

```
apps/backend/src/
  shared/
    config/      # @nestjs/config + zod-validated env (fail-fast)
    logging/     # pino structured logs + nestjs-cls correlation IDs
    crypto/      # AES-256-GCM EncryptionService (PII / biometric refs)
    events/      # domain-event, EventPublisher→outbox, TransactionManager, OutboxRelay
    audit/       # AuditListener ('**') → append-only AuditLog
    auth/        # provider-agnostic auth, JWT, refresh rotation, RBAC guards, seeder
    common/      # zod validation pipe, RFC-7807 exception filter
  modules/
    identity/    # users + GET /users/me
    inbox/       # unified Requests & Alerts feed (GET /inbox?kind=)
    visits/      # visit request detail + cancel/edit/approve/deny
    alerts/      # alert detail + status (acknowledge/resolve/dismiss)
    notes/       # add freeform notes to a visit/alert
  app.controller.ts   # GET / and GET /health (DB-aware)
```

### Event‑driven foundation (transactional outbox)

The single most important architectural property. A use‑case performs its state
change **and** appends the resulting domain event to the `OutboxEvent` table in
**one transaction** (`TransactionManager.run` + `EventPublisher.publish(tx, …)`).
A polling **`OutboxRelay`** then republishes pending rows onto an in‑process bus
(EventEmitter2) and marks them published.

```
UseCase ─ tx ─▶ repo.update(tx)  +  outbox.append(tx, Event)     (atomic)
OutboxRelay (poll) ─▶ EventEmitter2 ─▶ handlers (audit, notifications, …)
```

Because the relay is the only component that knows the transport, swapping to
**NATS** later is a relay‑only change — domain code is untouched. Event metadata
carries the correlation id (and actor) captured from the request CLS.

### Auth & RBAC

- **Provider‑agnostic**: `AuthService` depends on a `CredentialAuthProvider`
  interface. `LocalAuthProvider` (email + password, argon2) is the only
  implementation today; an OIDC/Okta provider plugs in without touching
  controllers, guards, or the token/session machinery.
- **Tokens**: short‑lived **JWT access token** (claims: sub, email, roles,
  permissions, tenantId) + **opaque refresh token**. Refresh tokens are stored
  as SHA‑256 hashes, grouped by a rotation `family`. On refresh the old token is
  marked used and a new one issued; **reuse of a used token revokes the whole
  family** (theft defense).
- **Authorization**: a global `JwtAuthGuard` (opt out with `@Public()`) and a
  global `PermissionsGuard` enforcing `@RequirePermissions('visit:approve')`.
  Permissions ride in the access token, so checks need no per‑request DB hit.

### Audit & observability

- **Audit** is fed by the event stream: one `AuditListener` (`@OnEvent('**')`)
  writes an append‑only `AuditLog` row for every domain event — business code
  never calls the audit log directly.
- **Logging**: `nestjs-pino` structured JSON, with **correlation IDs** from
  `nestjs-cls` (taken from the inbound `x-correlation-id` header or generated)
  stamped on every log line. Sensitive fields are redacted.
- **Errors**: a global exception filter returns RFC‑7807‑style problem responses
  and logs 5xx with the correlation id. (Designed to ship logs to SEQ later.)

### Data model (Prisma + Postgres 16)

21 tables: **Identity/Auth/Audit** — `User`, `Role`, `Permission`,
`RolePermission`, `UserRole`, `Session`, `RefreshToken`, `AuditLog`;
**Domain** — `Visitor`, `Host`, `Visit` (with `createdById`/`source` for request
origin), `Invitation`, `Pass`, `AccessCard`, `Rating`, `Alert`, `Note` (freeform
remarks, polymorphic to visit/alert), `GateEvent`, `ShiftAttendance`,
`Notification`; **Events** — `OutboxEvent`. Enums mirror `@vms/contracts`. PII
columns (`Visitor.phone`, `nationalId`) and `ShiftAttendance.fingerprintTemplateRef`
are intended for column encryption — biometrics stored only as an external
reference/hash, never raw.

## Frontend — layered

```
apps/frontend/
  app/[locale]/      # routing: login (/), dashboard, requests; shared _components (AppTopNav)
  data/              # http client (auth header + correlation id + refresh-on-401), api modules + TanStack Query hooks
  shared/            # AuthContext (provider-agnostic), providers (TanStack Query), RouteGuard
  i18n/ + messages/  # next-intl config + en/fr/ar catalogs
```

Screens: **login** (`/`), **dashboard** (top‑nav layout, stat strip + visitor
records), and **Requests & Alerts** (`/requests` — inbox card grid + a detail
drawer driven by `/inbox`, `/visits/:id`, `/alerts/:id`). The shared `AppTopNav`
routes between dashboard and requests via the segmented control.

Dependencies point downward (Presentation → Application/Data → Shared). The data
layer is the sole owner of `fetch`; the UI consumes typed contracts so it never
couples to backend response shape. Server state via **TanStack Query**; auth is a
React context that orchestrates tokens and silent refresh.

### i18n & RTL

next‑intl with `[locale]` routing (`en` default, unprefixed; `fr`, `ar`
prefixed). Arabic renders `dir="rtl"`; components use **logical CSS properties**
so layout flips automatically. Design tokens are direction‑agnostic.

## Design system

Tokens in `@vms/tokens` (Tailwind v4 `@theme`): primitive palette →
**semantic tokens** consumed by components; light/dark via `[data-theme]`.
`@vms/ui` is layered **foundations → primitives → components → patterns** on
Radix UI / React Aria, styled with tailwind‑variants. See
[design-system.md](./design-system.md).

## Deployment

Local: Docker Compose (Postgres + backend + frontend + Adminer); both app images
build via `turbo prune`. Cloud: Terraform (AWS) provisions VPC + EC2 ×2 + RDS
Postgres. See [runbook.md](./runbook.md).
