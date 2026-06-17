# System Inspection Report

A read-only architecture inspection of the AATC VMS monorepo, assessing system maturity and
scalability across five dimensions: i18n/localization, event-driven architecture, microservice
readiness, testing, and key risks. Findings are verified against source on `develop` as of
**2026-06-17**.

> Companion document: [api-inventory.md](./api-inventory.md) (complete endpoint catalogue).
> Background: [architecture.md](./architecture.md), [runbook.md](./runbook.md).

---

## A. i18n / Localization State

### Frontend — fully implemented ✅

| Aspect | Finding | Location |
| --- | --- | --- |
| Library | **next-intl v4** | `apps/frontend/package.json` |
| Locales | `en` (default, unprefixed), `fr`, `ar` — `localePrefix: "as-needed"` | `apps/frontend/i18n/routing.ts` |
| Middleware | `createMiddleware(routing)` on all non-API/internal paths | `apps/frontend/middleware.ts` |
| Request config | dynamic per-locale message loading | `apps/frontend/i18n/request.ts` |
| Navigation | locale-aware `Link`/`redirect`/`useRouter`/`usePathname` | `apps/frontend/i18n/navigation.ts` |
| Catalogs | `messages/{en,fr,ar}.json`, flat dot-notation keys, **full parity** (14 top-level groups: app, nav, login, dashboard, common, requests, language, roles, signup, admin, staff, gate, users, settings — 111 leaf-groups each) | `apps/frontend/messages/` |
| Usage | client-side `useTranslations(namespace)` (no server `getTranslations` in app code) | `app/[locale]/**` |
| Runtime switching | **Yes** — `LanguageSwitcher.tsx` globe popover, `router.replace(pathname, { locale })` preserves path | `app/[locale]/_components/LanguageSwitcher.tsx` |
| RTL | `dir="rtl"` for Arabic on `<html>`; logical Tailwind props (`ms/me`, `ps/pe`, `text-start`) flip layout | `app/[locale]/layout.tsx` |

### Backend — architecturally prepared, **not implemented** ⚠️

- **No email infrastructure**: no mailer (nodemailer/SendGrid/etc.), no templates, no send logic.
- **No notification service/handler**: the `Notification` Prisma model exists with a `locale`
  enum (default `EN`), `channel` (EMAIL/SMS/IN_APP), `templateKey`, `status` (PENDING…) — i.e. the
  schema anticipates localized async notifications, but **nothing renders or sends them**.
- **Locale is carried, not consumed**: `EventMetadata.locale` is part of every domain event
  (`shared/events/domain-event.ts`), available to a future handler — but no handler reads it.
- **API errors are English-only** (RFC-7807 responses are not localized).

### Architecture

- Localization is **not duplicated** — frontend owns UI i18n; backend would own notification
  template rendering (a current gap).
- **No shared i18n package** in `packages/` (`@vms/contracts`, `@vms/ui`, `@vms/tokens` are not
  localized).
- **Strategy is clear on the frontend, absent on the backend**: the data model and event metadata
  are deliberately locale-ready, but the rendering/delivery layer is unbuilt.

**Gaps:** notification template service (fetch by `templateKey` + `locale`), template rendering,
message composition (email/SMS), localized API error messages.

---

## B. Event-Driven Architecture

### Current state — **yes, event-driven via transactional outbox** ✅

The system is event-driven for all functional domain flows. The mechanism is a **transactional
outbox** over an **in-process bus** (no external broker today).

```
UseCase ─ tx ─▶ repo.update(tx) + outbox.append(tx, Event)        (one atomic transaction)
OutboxRelay (poll, OUTBOX_POLL_INTERVAL_MS) ─▶ EventEmitter2 ─▶ handlers (AuditListener, …)
```

| Component | Role | Location |
| --- | --- | --- |
| `TransactionManager` | wraps `prisma.$transaction`, makes state change + event append atomic | `shared/events/transaction.manager.ts` |
| `EventPublisher` | stamps correlation/actor/ip/ua from CLS; appends to outbox in the caller's tx | `shared/events/event-publisher.ts` |
| `OutboxRepository` | `append` / `fetchPending` / `markPublished` / `markFailed` (backoff) | `shared/events/outbox.repository.ts` |
| `OutboxRelay` | polls PENDING rows (batch 50), emits to EventEmitter2, marks published — **the only transport-aware component** | `shared/events/outbox.relay.ts` |
| `AuditListener` | `@OnEvent('**')` → one append-only `AuditLog` row per event | `shared/audit/audit.listener.ts` |

- **Events defined** in `shared/events/domain-event.ts` (`EVENT_TYPES`): visit (approved/denied/
  cancelled/updated), `visitor.checked_in/out`, `invitation.created`, `alert.updated`,
  `note.added`, `visitor.rated`, user lifecycle (created/roles_updated/profile_updated/
  password_changed/deleted). These are **canonical names**, not zod schemas — payloads are typed at
  call sites, not validated by a contract.
- **Security events** (`auth.login_failed`, `auth.logout`, `auth.token_refreshed`,
  `auth.refresh_reuse_detected`, `auth.role_switched`, `authz.permission_denied`) are recorded
  **directly** via `SecurityAuditService` (→ AuditLog + Seq), bypassing the outbox by design (no
  successful business transaction to ride).
- **Producers**: `visits`, `alerts`, `notes`, `identity/users` services publish via
  `TransactionManager` + `EventPublisher`. `inbox` is read-only (no events).
- **Coupling**: loose — producers know `EventPublisher`, not consumers; consumers subscribe via the
  bus. Audit is fully event-driven (business code never calls the audit log directly).

### External brokers — **none**

No Kafka/NATS/RabbitMQ dependencies. Bus is `@nestjs/event-emitter` (EventEmitter2, wildcard +
dot-delimited).

### NATS/Kafka readiness — **natural extension, relay-only change** ✅

The outbox + relay design isolates transport in a single class. Moving to NATS means changing
`OutboxRelay` to publish to NATS (and adding `@MessagePattern` consumers) — **producers, the outbox
write path, and handlers are untouched**. This is the cleanest possible migration posture; the
codebase was explicitly built for it (see comments in `event-publisher.ts` / `outbox.relay.ts`).

**One caveat:** consumers currently live in-process. A true broker migration also means deciding
which handlers move out-of-process and adding idempotency/consumer-group semantics — the relay swap
is necessary but not by itself sufficient for multi-service event consumption.

---

## C. Microservice Readiness

### Current architecture — **modular monolith**

Clean domain modules over shared infrastructure, single deployable, single database.

```
modules/   identity · visits · alerts · notes · inbox          (domain)
shared/    config · logging · prisma · crypto · storage ·
           events · audit · auth                               (infrastructure + auth)
```

### Coupling assessment

| Coupling | Strength | Detail |
| --- | --- | --- |
| Domain ↔ Domain | **Loose** | No cross-domain imports (e.g. visits never imports alerts). Inbox reads both tables directly but imports neither module. |
| Domain ↔ Events | **Loose (mediated)** | All writers use `TransactionManager`/`EventPublisher` from the shared events module, not each other. |
| Domain ↔ Prisma | **Tight** | Every service injects the **single global `PrismaService`**; no repository abstraction. One Postgres, ACID across domains. |
| Auth ↔ Identity | **Tight (circular, mitigated)** | `AuthModule` imports `IdentityModule` for `UsersService`; the circular dep is broken by re-providing `PasswordService` in both. |
| Auth ↔ everything | **Tight (by design)** | Global `JwtAuthGuard` + `PermissionsGuard` (`APP_GUARD`) weave auth into every route. |

### Migration readiness

- **Easiest to extract**: `inbox` (read-only, depends only on Prisma — a pure read model).
- **Medium**: `visits`, `alerts`, `notes` — self-contained domains; need (a) an event-bus
  abstraction (half-done via the relay) and (b) their own data ownership.
- **Hardest**: `identity`/`auth` — tightly woven into every request via global guards and the
  in-token permission model.
- **Primary blocker**: the **single shared Postgres**. Domain boundaries are logical, not physical;
  true microservices require splitting the schema (with eventual consistency for cross-domain reads
  like the inbox) and moving the bus off in-process EventEmitter2.

**Verdict:** early-microservice-*ready* modular monolith. The event/relay seam and clean module
boundaries mean extraction is evolutionary, not a rewrite — but the shared DB must be addressed
before any module becomes a true service.

---

## D. Testing Architecture

### Types present

| Type | Present? | Where | Count |
| --- | --- | --- | --- |
| Unit (backend) | ✅ | `apps/backend/src/**/*.spec.ts` (co-located) | 14 |
| E2E (backend) | ✅ | `apps/backend/test/*.e2e-spec.ts` | 2 (`app`, `auth`) |
| Integration | ➖ | overlaps the e2e suite (boots the Nest app); no separate tier | — |
| Contract tests (`@vms/contracts`) | ❌ | none | 0 |
| Frontend (unit/component/e2e) | ❌ | none | 0 |
| UI / Storybook | ⚠️ | `build-storybook` is the only UI gate (no test-runner/interaction tests) | — |
| Infra (docker/db/seq) | ❌ | none | 0 |

Runner: **Jest + ts-jest**. Unit config inline in `apps/backend/package.json` (`testRegex
.*\.spec\.ts$`, `rootDir: src`); e2e via `apps/backend/test/jest-e2e.json`.

### What is covered (backend unit + e2e)

- **Auth**: `auth.service`, `password.service`, `refresh.service`, `token.service`, `guards`
  (JwtAuthGuard + PermissionsGuard / RBAC) + `auth.e2e-spec.ts`.
- **Audit**: `audit.listener`, `security-audit.service`, `seq.service`.
- **Outbox/events**: `event-publisher`, `outbox.relay`.
- **Crypto**: `encryption.service` (AES-256-GCM).
- **Common**: `all-exceptions.filter` (RFC-7807), `zod-validation.pipe`.
- **App/health**: `app.controller` + `app.e2e-spec.ts`.

### How to run

| Goal | Command |
| --- | --- |
| **All tests** (every workspace) | `npx turbo run test` |
| **Only unit (backend)** | `npm test -w @vms/backend` |
| **Single file** | `npm test -- path/to/file.spec.ts -w @vms/backend` |
| **Only e2e (backend)** | `npm run test:e2e -w @vms/backend` |
| **Coverage** | `npm run test:cov -w @vms/backend` |
| **Backend-only via Turbo filter** | `npx turbo run test --filter=@vms/backend` |
| **Frontend tests** | _none exist_ |

**Turbo orchestration** (`turbo.json`): the `test` task declares `dependsOn: ["^build"]` (deps
build first) and caches `coverage/**`. Only `@vms/backend` defines a `test` script, so
`turbo run test` effectively runs the backend suite. `test:e2e` and `test:cov` are **not** Turbo
tasks — they are invoked directly per-workspace (notably in CI).

**CI pipeline** (`.github/workflows/ci.yml`, `apps` job): `lint:check` → `typecheck` → `build` →
`build-storybook` → `turbo run test` → `npm run test:cov -w @vms/backend` → `npm run test:e2e -w
@vms/backend` (e2e runs with a CI `JWT_SECRET`). A second `terraform` job runs `fmt`/`validate`.

### Coverage analysis

| Critical domain | Covered? |
| --- | --- |
| Auth (login/refresh/token/password) | ✅ Strong (unit + e2e) |
| RBAC / permissions guards | ✅ (`guards.spec.ts`) |
| Audit log / listener | ✅ |
| Outbox / relay | ✅ |
| Security events | ✅ (`security-audit.service.spec.ts`) |
| Crypto / column encryption | ✅ |
| **Domain services (visits, alerts, notes, inbox, users)** | ❌ **No unit tests** |
| **Frontend (auth context, RouteGuard, data layer, i18n)** | ❌ **No tests** |
| **`@vms/contracts` schemas** | ❌ No tests |

The **security/infrastructure spine is well-tested**; the **business logic layer and the entire
frontend are untested**. The Jest coverage threshold is set low (`statements 32%`, `branches 30%`,
`functions 22%`, `lines 32%`), which keeps CI green despite the domain-service gap.

---

## E. Key Risks / Gaps

1. **Domain service layer has no unit tests.** `visits`, `alerts`, `notes`, `inbox`, and
   `identity/users` services — the actual business rules and the producers of every domain event —
   are exercised only incidentally (if at all). Highest-value, lowest-coverage area.
2. **Zero frontend tests.** Auth context, silent-refresh-on-401, RouteGuard, the `data/` fetch
   layer, and i18n rendering have no automated coverage.
3. **Backend notification/localization pipeline is schema-only.** The data model and event metadata
   advertise locale-aware notifications, but no mailer/template/handler exists — a capability gap
   that may read as "implemented" from the schema alone.
4. **Low coverage threshold (32%) masks the gap in CI.** Green builds do not imply the domain layer
   is tested.
5. **Single shared Postgres is the structural blocker** to microservice extraction; domain
   isolation is logical only.
6. **`@vms/contracts` has no contract tests.** It is the cross-app source of truth for request/
   response shapes and enums; a breaking schema change wouldn't be caught by a test.
7. **Event payloads are not schema-validated.** `EVENT_TYPES` are string names; event payloads are
   typed at call sites but not validated by a contract, so a malformed payload only surfaces at the
   consumer.

---

*Inspection method: three parallel read-only Explore agents plus direct source verification
(controllers, `domain-event.ts`, `turbo.json`, `ci.yml`, Prisma schema, message catalogs). No code
was modified.*
</content>
