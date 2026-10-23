# AATC VMS — Implementation Checklist (Build-Order)

A full-project audit of the AATC Visitor Management System (Turborepo monorepo:
NestJS 11 backend + Next.js 16 frontend + shared zod contracts + Storybook
design system), presented as a **single sequential checklist** organized in the
logical order a project is normally _built_ — not the order things happened
historically. Each line is a reasonable, developer-assignable unit of work.

Findings were gathered by reading the full codebase and every doc in `docs/`.
Where docs disagreed with code (several are stale), status reflects the **actual
code**.

**Status legend:** ✅ Implemented · 🟡 Partial · ❌ Not implemented

**Scorecard:** ✅ ~62 · 🟡 ~19 · ❌ ~17 (across ~98 units of work)

---

## Phase 0 — Foundations & Project Setup

- [x] ✅ **Monorepo scaffolding** — Turborepo pipeline (build/lint/typecheck/test), npm workspaces, Node pinned via `.nvmrc` (20.11.0)
- [x] ✅ **Shared tooling config** — strict shared `tsconfig.base.json`, ESLint + Prettier via `@vms/config`
- [x] ✅ **Shared contracts package** — `@vms/contracts` (zod) as single source of truth for request/response shapes + enums; ships a built `dist` for the backend
- [x] ✅ **Design tokens** — `@vms/tokens` Tailwind v4 theme, full light + dark value sets, semantic aliases
- [x] ✅ **UI component library** — `@vms/ui`: 15 primitives, 16 components, 9 patterns (Radix / React Aria + tailwind-variants)
- [ ] 🟡 **Storybook** — set up with a11y + light/dark + LTR/RTL toggles; **2 components lack stories** (`Label`, `Drawer`)
- [x] ✅ **Local dev environment** — `docker-compose` (Postgres, Adminer, Seq), multi-stage Dockerfiles, DB-wait entrypoint
- [x] ✅ **Database schema & migrations** — Prisma + Postgres, 22 models, 13 coherent migrations
- [x] ✅ **Environment validation** — zod `envSchema`, fail-fast at boot with readable errors

## Phase 1 — Authentication & Security Core

- [x] ✅ **Password authentication** — argon2 hashing, `CredentialAuthProvider` seam (`LocalAuthProvider`)
- [x] ✅ **JWT access + refresh tokens** — short-lived access JWT carrying roles+permissions (no per-request DB hit)
- [x] ✅ **Refresh-token rotation & reuse defense** — SHA-256 hashed, grouped by family; reuse revokes the whole family + security audit
- [x] ✅ **RBAC** — global `JwtAuthGuard` (+ `@Public`) & `PermissionsGuard` (`@RequirePermissions`); idempotent role/permission seeding
- [x] ✅ **Multi-role users & role switching** — `POST /auth/switch-role`, active role persisted, token re-minted with scoped permissions
- [ ] 🟡 **Account provisioning / first-admin bootstrap** — signup bootstraps SUPER_ADMIN, admin creates users; **first-run lock disabled** (`signupAvailable` hardcoded `true`)
- [ ] ❌ **SSO / Okta (OIDC)** — provider seam + `AuthProvider` enum + `externalSubjectId` column only; no OIDC implementation (FE button disabled)
- [ ] ❌ **MFA** — `User.mfaEnabled` column only; no flow
- [ ] ❌ **Rate limiting** — none (login/refresh unthrottled; no `@nestjs/throttler`)
- [ ] 🟡 **HTTP hardening** — `helmet()` on; **CORS is permissive/default** (`enableCors()` with no config)
- [ ] 🟡 **PII field encryption (AES-256-GCM)** — `EncryptionService` built & tested but **never called on write**; `Visitor.phone` stored plaintext, `nationalId` not captured

## Phase 2 — Event Infrastructure, Audit & Observability

- [x] ✅ **Transactional outbox** — state change + `OutboxEvent` in one transaction (`EventPublisher.publish(tx, …)`)
- [x] ✅ **Outbox relay + in-process bus** — `OutboxRelay` polls & re-emits onto EventEmitter2 with backoff
- [x] ✅ **Audit logging** — append-only `AuditLog` via `AuditListener` (`@OnEvent('**')`) + `SecurityAuditService` for txn-less security events
- [x] ✅ **Structured logging + correlation IDs** — `nestjs-pino` + `nestjs-cls`, stamped on every log line & event metadata
- [x] ✅ **RFC-7807 error responses** — global `AllExceptionsFilter` with localized messages
- [ ] 🟡 **Seq audit mirror** — best-effort CLEF shipping when `SEQ_URL` set; **local only, not deployed to prod**
- [ ] 🟡 **Health endpoint** — `GET /health` pings DB but always returns `status: ok`
- [ ] ❌ **NATS transport** — docs/comments only; not in code (relay-only future swap)
- [ ] ❌ **APM / metrics / alerting** — no Prometheus/OTel/CloudWatch alarms/dashboards

## Phase 3 — Frontend Foundation

- [x] ✅ **App Router + layered architecture** — `app/[locale]/` screens, `data/` as sole `fetch` owner, `shared/` providers
- [x] ✅ **HTTP client** — injects auth header + correlation id + locale; transparent refresh-once-on-401
- [x] ✅ **Auth on frontend** — `AuthContext`, providers, `RouteGuard`, permission-based UI gating, token store
- [x] ✅ **i18n (en/fr/ar) + RTL** — next-intl, 470 keys per catalog with zero drift, logical CSS properties + `rtl:` variants
- [ ] 🟡 **Dark mode runtime toggle** — tokens & Storybook fully support dark, but app **hardcodes `data-theme="light"`**; no user toggle

## Phase 4 — Core Visitor Management

- [x] ✅ **Visitor & visit data model + contracts** — visits, visitors, passes, access cards, gate events
- [x] ✅ **Walk-in visitor registration** — auto-approved, badge assigned at check-in
- [x] ✅ **Invited / pre-registered registration** — single + bulk + true group visits; reference code + QR; emits `visit.requested`
- [x] ✅ **Multi-step request form (FE)** — form → confirm → success; multi-guest pager, group toggle, CSV import/template
- [x] ✅ **Approve / reject requests** — single + bulk group (`GroupApprovalSheet`)
- [x] ✅ **Edit / request-more-info / resubmit** — VMC edit of PENDING/NEEDS_MORE_INFO; host resubmit
- [x] ✅ **Check-in / check-out** — assigns/releases `AccessCard` badge, mints/returns `Pass`, writes `GateEvent`
- [x] ✅ **Group check-in** — bulk queue with per-guest actions
- [x] ✅ **Access card / badge pool** — read-only pool for the check-in dropdown
- [x] ✅ **Cancel / resend invite code / post-visit rating** — 1–5 rating, host/creator only, after checkout
- [ ] 🟡 **Visitor search & filtering** — works on staff + inbox; **VMC dashboard filter selects & search are non-functional stubs**

## Phase 5 — Role Workspaces & Screens

- [ ] 🟡 **VMC dashboard (visitor board)** — live table + timers + row actions; **stat tiles are mocked (12/28/16)**, top filter bar is decorative
- [x] ✅ **Staff dashboard** — stats, today's schedule, my visits (in-progress on `staff-invite-flow`)
- [x] ✅ **Staff updates / activity feed** — category chips + date filter over audit-derived feed
- [x] ✅ **Requests & Alerts inbox** — tabs, debounced search, working filters, unread nav bubble, mark-seen
- [x] ✅ **Visit / alert detail sheet** — permission-gated actions, timeline, QR/resend, inline notes, post-checkout rating
- [x] ✅ **Admin — pending approvals + user management** — full user CRUD, role editing, self-delete disabled
- [ ] 🟡 **Settings** — profile/password/preferences/my-desk wired; a few no-op buttons (report issue, help) + hardcoded desk text
- [ ] ❌ **Gate validation module & UI** — FE page is a placeholder; no gate scan/QR-verify endpoints; gate event types never produced

## Phase 6 — Notifications & Communications

- [x] ✅ **Notification pipeline** — durable `Notification` rows → dispatcher polls, renders, delivers, retries with backoff
- [x] ✅ **Email transport** — provider selector (smtp / gmail / mailtrap / sendgrid), falls back to log provider
- [x] ✅ **SMS transport** — Twilio (no-op when unconfigured)
- [x] ✅ **WhatsApp transport** — twilio or meta cloud; template (HSM) mode
- [x] ✅ **Email templating** — MJML + Handlebars with i18n `{{t}}` helper + inline QR
- [x] ✅ **In-app notifications feed** — persisted rows + REST (list / read / read-all)
- [ ] 🟡 **Notification preferences** — `notificationPrefs` stored & updatable but **not honored** in enqueue
- [ ] ❌ **WhatsApp media (QR image)** — text code only; needs public URL

## Phase 7 — Alerts, Notes, Reporting & Advanced Domain

- [x] ✅ **Alerts triage** — acknowledge / resolve / dismiss; emits `alert.updated`
- [x] ✅ **Notes** — polymorphic notes on visits or alerts
- [ ] ❌ **Alert raising / risk engine** — no create/escalate endpoint; alerts only seeded; `alert:escalate` permission unused; no risk scoring / flagged-profile matching
- [ ] ❌ **Reporting / analytics / exports** — none beyond staff stats endpoint
- [ ] ❌ **Biometric shift attendance** — `ShiftAttendance` model + enum only; no service/controller
- [ ] ❌ **Standalone visitor register / pass lifecycle endpoints** — `Invitation` model unused; visitors created only as a side effect of visits

## Phase 8 — File Storage & Media

- [x] ✅ **S3 presigned uploads (avatars)** — `S3Service` presigned PUT via AWS SDK
- [ ] ❌ **Visitor photo / document uploads** — not wired
- [ ] ❌ **WhatsApp media delivery** — see Phase 6

## Phase 9 — Testing & Code Quality

- [ ] 🟡 **Backend unit tests** — 30 spec files (auth, events, crypto, notifications, visits/inbox/staff); **no specs for alerts/notes/users/s3 services**
- [ ] 🟡 **Backend e2e** — app + auth flows only; no visits-lifecycle / notifications e2e
- [ ] 🟡 **Coverage thresholds** — gate exists but very low (stmts 32 / branches 30 / funcs 22 / lines 32)
- [ ] ❌ **Frontend tests** — none
- [ ] ❌ **Contracts package tests** — none
- [x] ✅ **SonarQube — local + CI** — full local profile (compose + scanner script) + CI analysis
- [ ] 🟡 **Sonar quality gate enforcement** — scan only; no pass/fail gate ("no quality-gate stage yet"; CI Sonar step is advisory)

## Phase 10 — CI/CD & Deployment

- [x] ✅ **GitHub Actions CI** — lint → typecheck → build → storybook → test → coverage gate → e2e → Sonar; + Terraform fmt/validate job
- [x] ✅ **Jenkins CI + CD pipeline** — CI stages + Sonar + Terraform-validate + gated manual-approval Deploy stage
- [x] ✅ **Deploy script** — `vms-deploy.sh` per-app git-SHA image tags, ECR login/build/push, bootstrap phase
- [x] ✅ **Branch strategy** — main (prod) / staging / develop, CI on all three
- [ ] 🟡 **Jenkins provisioning** — Terraform builds the host; plugin seeding is best-effort (may need manual install)

## Phase 11 — Infrastructure (Terraform / AWS)

- [x] ✅ **Terraform state bootstrap** — versioned/encrypted S3 state bucket + DynamoDB lock table (`prevent_destroy`)
- [x] ✅ **App stack** — VPC + subnets, EC2 frontend + backend, RDS Postgres 16, ECR repos, ALB + HTTPS + ACM + Route53, IAM instance profiles
- [x] ✅ **Jenkins stack** — standalone always-on Jenkins EC2 (Terraform-provisioned)
- [x] ✅ **Containerization for prod** — multi-stage Dockerfiles, `turbo prune`, non-root, migrate-on-boot entrypoint
- [ ] 🟡 **Secrets management** — Terraform-generated JWT/encryption/DB secrets in encrypted state; **no AWS Secrets Manager / SSM** (flagged as later work)
- [ ] ❌ **RDS durability** — `skip_final_snapshot=true`, no backup retention, no Multi-AZ — **no DB backups**
- [ ] ❌ **Container orchestration / autoscaling** — deliberate single-EC2-per-app model; no ECS/EKS, no horizontal scaling

## Phase 12 — Documentation & Ops Hygiene

- [x] ✅ **Core docs** — architecture, runbook, api, design-system, notifications, infrastructure, CI, Sonar-local (+ README, CLAUDE.md)
- [ ] 🟡 **Doc accuracy** — several docs stale (approval-mints-pass, "no load balancer", state "local", api-inventory predates check-in/notifications)
- [ ] 🟡 **Production demo-seed guard** — `NODE_ENV !== production` guard commented out, so demo users/visits/alerts seed into prod
- [ ] 🟡 **Repo hygiene** — AWS CLI installer (`awscliv2.zip` ~72 MB + `aws/` bundle) accidentally committed to git; should be removed/gitignored

---

## Notes for the reader

- **Biggest security gaps to prioritize:** PII encryption not applied on write (Phase 1), no rate limiting (Phase 1), permissive CORS (Phase 1), demo data + open signup in production (Phases 12/1), no DB backups (Phase 11).
- **Clearly "planned, not started" (design seams exist):** SSO/Okta, MFA, NATS, gate operations, biometric attendance, reporting — these have models/enums/interfaces but no working code.
- **In-flight now:** the `staff-invite-flow` branch (redesigned staff dashboard, updates feed, detail sheet, invite flow) is functional but uncommitted.
