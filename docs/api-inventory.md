# API Inventory

A complete, Postman-ready catalogue of the VMS backend HTTP API (NestJS, default base URL
`http://localhost:4000`). This is the source list for building a Postman collection and
generating API reference docs. Request/response shapes derive from `@vms/contracts` (zod).

> **Status as of 2026-06-18 (`develop`).** 33 implemented endpoints across 8 controllers.
> See [api.md](./api.md) for narrative examples and [architecture.md](./architecture.md) for
> the auth/event model, and [notifications.md](./notifications.md) for the notification system.

## Conventions (apply to every request)

| Concern           | Detail                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Base URL**      | `http://localhost:4000` (env: `NEXT_PUBLIC_API_BASE_URL`)                                                                                        |
| **Auth**          | `Authorization: Bearer <accessToken>` on all routes except those marked **Public**. A global `JwtAuthGuard` enforces this; `@Public()` opts out. |
| **Authorization** | A global `PermissionsGuard` enforces `@RequirePermissions(...)`. Permissions ride in the JWT (no per-request DB hit). 403 on missing permission. |
| **Correlation**   | Send `x-correlation-id` to trace a request across logs/audit; generated if absent.                                                               |
| **Validation**    | Bodies/queries validated with zod (`ZodValidationPipe`); failures return `400`.                                                                  |
| **Errors**        | RFC-7807-style: `{ type, title, status, detail, instance, timestamp }`.                                                                          |
| **Content-Type**  | `application/json` for all bodies.                                                                                                               |

### Suggested Postman environment variables

| Variable        | Example                 | Notes                                               |
| --------------- | ----------------------- | --------------------------------------------------- |
| `baseUrl`       | `http://localhost:4000` |                                                     |
| `accessToken`   | `<jwt>`                 | Set from `POST /auth/login` → `tokens.accessToken`. |
| `refreshToken`  | `<opaque>`              | Set from login; rotated on refresh.                 |
| `correlationId` | `{{$guid}}`             | Optional header `x-correlation-id`.                 |

---

## Implemented Endpoints

### App / Health — `app.controller.ts`

| #   | Method | Path      | Auth   | Permission | Request | Response                                                                     | Status         |
| --- | ------ | --------- | ------ | ---------- | ------- | ---------------------------------------------------------------------------- | -------------- |
| 1   | `GET`  | `/`       | Public | —          | —       | `"Hello World!"` (text)                                                      | ✅ Implemented |
| 2   | `GET`  | `/health` | Public | —          | —       | `{ status: "ok", database: "connected"\|"disconnected", error?, timestamp }` | ✅ Implemented |

> `status` is `"ok"` in both branches — probe `database` (pings DB with `SELECT 1`).

### Auth — `shared/auth/auth.controller.ts` (base `/auth`)

| #   | Method | Path                     | Auth   | Permission                   | Request DTO                                                  | Response                                                                                            | Status                                                                                    |
| --- | ------ | ------------------------ | ------ | ---------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 3   | `POST` | `/auth/login`            | Public | —                            | `LoginInput` `{ email, password }`                           | `200` `{ user: UserProfile, tokens: { accessToken, expiresIn, tokenType:"Bearer" }, refreshToken }` | ✅ Implemented                                                                            |
| 4   | `POST` | `/auth/signup`           | Public | —                            | `SignupInput` `{ email, fullName, password(≥8) }`            | `201` `AuthResult`                                                                                  | ✅ Implemented — **first-run only** (bootstraps initial SUPER_ADMIN; 403 once one exists) |
| 5   | `GET`  | `/auth/signup-available` | Public | —                            | —                                                            | `{ available: boolean }`                                                                            | ✅ Implemented                                                                            |
| 6   | `POST` | `/auth/switch-role`      | Bearer | — (role membership enforced) | `SwitchRoleInput` `{ role }`                                 | `200` `{ user, tokens }` (re-minted, active-role-scoped)                                            | ✅ Implemented                                                                            |
| 7   | `POST` | `/auth/change-password`  | Bearer | —                            | `ChangePasswordInput` `{ currentPassword, newPassword(≥8) }` | `204` (revokes all sessions)                                                                        | ✅ Implemented                                                                            |
| 8   | `POST` | `/auth/refresh`          | Public | —                            | `{ refreshToken }`                                           | `200` `AuthResult` with **rotated** refresh token; reuse → `401` + family revoke                    | ✅ Implemented                                                                            |
| 9   | `POST` | `/auth/logout`           | Bearer | —                            | `{ refreshToken }`                                           | `204` (revokes token family + session)                                                              | ✅ Implemented                                                                            |

### Identity / Users — `modules/identity/users.controller.ts` (no path prefix)

| #   | Method   | Path                       | Auth   | Permission    | Request DTO                                                                                                         | Response                                                                    | Status                            |
| --- | -------- | -------------------------- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------- |
| 10  | `GET`    | `/users/me`                | Bearer | —             | —                                                                                                                   | `UserProfile` (+ `roles`, `activeRole`, `permissions` for active role)      | ✅ Implemented                    |
| 11  | `PATCH`  | `/users/me`                | Bearer | —             | `UpdateMeInput` `{ firstName?, lastName?, phone?, preferredLocale?, timezone?, assignedDesk?, notificationPrefs? }` | `UserProfile`                                                               | ✅ Implemented                    |
| 12  | `POST`   | `/users/me/avatar/presign` | Bearer | —             | `PresignAvatarInput` `{ contentType: image/jpeg\|png\|webp }`                                                       | `PresignResult` `{ uploadUrl, key }`                                        | ✅ Implemented (S3 presigned PUT) |
| 13  | `PUT`    | `/users/me/avatar`         | Bearer | —             | `UpdateAvatarInput` `{ avatarKey }`                                                                                 | `UserProfile`                                                               | ✅ Implemented                    |
| 14  | `GET`    | `/users/me/sessions`       | Bearer | —             | —                                                                                                                   | `LoginActivityItem[]` `{ id, os, browser, location?, lastSeenAt, current }` | ✅ Implemented                    |
| 15  | `GET`    | `/users`                   | Bearer | `user:read`   | `PaginationQuery` `{ page, pageSize, sortBy?, sortDir }`                                                            | `Paginated<UserListItem>`                                                   | ✅ Implemented                    |
| 16  | `POST`   | `/users`                   | Bearer | `user:create` | `CreateUserInput` `{ email, fullName, password(≥8), roles[] }`                                                      | `{ id, email, roles }`                                                      | ✅ Implemented                    |
| 17  | `PATCH`  | `/users/:id/roles`         | Bearer | `user:update` | `UpdateUserRolesInput` `{ roles[] }`                                                                                | `{ id, email, roles }`                                                      | ✅ Implemented                    |
| 18  | `DELETE` | `/users/:id`               | Bearer | `user:delete` | —                                                                                                                   | `204`                                                                       | ✅ Implemented                    |
| 19  | `GET`    | `/roles`                   | Bearer | `role:read`   | —                                                                                                                   | `string[]` (role names)                                                     | ✅ Implemented                    |

### Visits — `modules/visits/visits.controller.ts` (base `/visits`)

| #   | Method  | Path                    | Auth   | Permission        | Request DTO                                                       | Response                                                                                         | Status         |
| --- | ------- | ----------------------- | ------ | ----------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------- |
| 20  | `GET`   | `/visits/:id`           | Bearer | —                 | —                                                                 | `VisitRequestDetail` (visit + visitor + host + notes + `createdByName`/`source`)                 | ✅ Implemented |
| 21  | `POST`  | `/visits/:id/cancel`    | Bearer | `visit:cancel`    | —                                                                 | `VisitRequestDetail` (status `CANCELLED`); emits `visit.cancelled`                               | ✅ Implemented |
| 22  | `PATCH` | `/visits/:id`           | Bearer | `visit:edit`      | `UpdateVisitRequestInput` `{ purpose?, scheduledAt? }` (≥1 field) | `VisitRequestDetail`; emits `visit.updated`                                                      | ✅ Implemented |
| 23  | `POST`  | `/visits/:id/approve`   | Bearer | `visit:approve`   | —                                                                 | `VisitRequestDetail` (`APPROVED` + `approvedById`); emits `visit.approved`                       | ✅ Implemented |
| 24  | `POST`  | `/visits/:id/deny`      | Bearer | `visit:deny`      | `DenyVisitInput` `{ reason }`                                     | `VisitRequestDetail` (`DENIED` + `deniedReason`); emits `visit.denied`                           | ✅ Implemented |
| 24a | `POST`  | `/visits/:id/check-in`  | Bearer | `visit:check_in`  | —                                                                 | `VisitRequestDetail` (`CHECKED_IN`); activates pass, logs gate event, emits `visitor.checked_in` | ✅ Implemented |
| 24b | `POST`  | `/visits/:id/check-out` | Bearer | `visit:check_out` | —                                                                 | `VisitRequestDetail` (`CHECKED_OUT`); returns pass, emits `visitor.checked_out`                  | ✅ Implemented |

> Note: `/visits/:id/approve` now also **mints a `Pass`** (access code) atomically, enabling the
> approval notification's code + QR.

### Alerts — `modules/alerts/alerts.controller.ts` (base `/alerts`)

| #   | Method  | Path          | Auth   | Permission      | Request DTO                                                              | Response                                  | Status         |
| --- | ------- | ------------- | ------ | --------------- | ------------------------------------------------------------------------ | ----------------------------------------- | -------------- |
| 25  | `GET`   | `/alerts/:id` | Bearer | —               | —                                                                        | `AlertWithVisitor` (+ notes)              | ✅ Implemented |
| 26  | `PATCH` | `/alerts/:id` | Bearer | `alert:resolve` | `UpdateAlertStatusInput` `{ status: ACKNOWLEDGED\|RESOLVED\|DISMISSED }` | `AlertWithVisitor`; emits `alert.updated` | ✅ Implemented |

### Notes — `modules/notes/notes.controller.ts` (base `/notes`)

| #   | Method | Path     | Auth   | Permission | Request DTO                                                                 | Response                   | Status         |
| --- | ------ | -------- | ------ | ---------- | --------------------------------------------------------------------------- | -------------------------- | -------------- |
| 27  | `POST` | `/notes` | Bearer | `note:add` | `AddNoteInput` `{ visitId? \| alertId?, body(≤2000) }` (exactly one target) | `Note`; emits `note.added` | ✅ Implemented |

### Inbox (Requests & Alerts feed) — `modules/inbox/inbox.controller.ts` (base `/inbox`)

| #   | Method | Path     | Auth   | Permission | Request (query)                                                                           | Response                                               | Status         |
| --- | ------ | -------- | ------ | ---------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------- |
| 28  | `GET`  | `/inbox` | Bearer | —          | `InboxQuery` `{ kind: all\|requests\|alerts, search?, page, pageSize, sortBy?, sortDir }` | `Paginated<InboxItem>` (discriminated union on `kind`) | ✅ Implemented |

### Notifications (in-app) — `modules/notifications/notifications.controller.ts` (base `/notifications`)

| #   | Method  | Path                      | Auth   | Permission | Request                                                                 | Response                                                            | Status         |
| --- | ------- | ------------------------- | ------ | ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------- |
| 29  | `GET`   | `/notifications`          | Bearer | —          | `NotificationQuery` `{ unreadOnly?, page, pageSize, sortBy?, sortDir }` | `Paginated<NotificationItem>` (current user's IN_APP notifications) | ✅ Implemented |
| 30  | `PATCH` | `/notifications/:id/read` | Bearer | —          | —                                                                       | `{ id }` (marks one read)                                           | ✅ Implemented |
| 31  | `POST`  | `/notifications/read-all` | Bearer | —          | —                                                                       | `{ updated: number }`                                               | ✅ Implemented |

> Email/SMS/WhatsApp notifications are delivered out-of-band by the dispatcher (not via REST). See
> [notifications.md](./notifications.md).

---

## Partially Implemented / Notable behaviours

| Endpoint                           | Note                                                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/signup`                | Functionally complete, but **conditionally available** — only while no SUPER_ADMIN exists; otherwise blocked. `GET /auth/signup-available` advertises the state. |
| `GET /health`                      | `status` is always `"ok"` even when the DB is down by design; the real signal is `database`. Consumers must key off `database`, not `status`.                    |
| Avatar flow (`/users/me/avatar/*`) | Two-step: presign → client PUTs to S3 → persist key. Requires S3/storage env to be configured; otherwise presign fails.                                          |

No endpoints throw `NotImplemented` or return stub data — every route above is wired end-to-end
(controller → service → Prisma, with event emission where applicable).

---

## Planned / Not-Yet-Built Endpoints

These Prisma domain models exist (`apps/backend/prisma/schema.prisma`) but have **no controller
or route yet**. They define the most likely next API surface. Permission keys for some already
exist in `@vms/contracts` (`PERMISSIONS`), signalling intended endpoints.

| Domain model      | Inferred future endpoints                           | Evidence of intent                                                                         | State            |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------- |
| `Visitor`         | `POST/GET /visitors` (register, list, detail)       | `visitor:register` permission seeded; used by Visits/Alerts                                | 🔴 No controller |
| `Host`            | `GET /hosts`                                        | FK to `User`; referenced by Visits                                                         | 🔴 No controller |
| `Invitation`      | `POST /invitations` (issue), `GET /invitations/:id` | `invitation:create` permission seeded                                                      | 🔴 No controller |
| `Pass`            | `POST /passes` (issue), pass lifecycle              | Pass status enum (ISSUED/ACTIVE/RETURNED/REVOKED/EXPIRED)                                  | 🔴 No controller |
| `AccessCard`      | card assignment endpoints                           | Linked to `Pass`                                                                           | 🔴 No controller |
| `Rating`          | `POST /ratings` (post-visit)                        | `visitor.rated` event type defined                                                         | 🔴 No controller |
| `GateEvent`       | `POST /gate-events`, gate check-in/out              | `visit:check_in` / `visit:check_out` perms seeded; `visitor.checked_in/out` events defined | 🔴 No controller |
| `ShiftAttendance` | staff clock-in/out (biometric ref)                  | `fingerprintTemplateRef` column                                                            | 🔴 No controller |
| `Notification`    | notification list / preferences delivery            | `locale` enum + `templateKey`; no mailer/handler                                           | 🔴 No controller |

> Infra/auth tables (`OutboxEvent`, `Role`, `Permission`, `RolePermission`, `UserRole`,
> `Session`, `RefreshToken`, `AuditLog`) are managed internally and are **not** intended as REST
> resources. A **visits list** endpoint for the dashboard (vs. the current single-`:id` fetch) is
> also noted as a roadmap item in [api.md](./api.md).

---

## Reference: seeded permission keys (`@vms/contracts` `PERMISSIONS`)

`visit:approve` · `visit:deny` · `visit:cancel` · `visit:edit` · `visit:check_in` ·
`visit:check_out` · `visitor:register` · `invitation:create` · `alert:escalate` ·
`alert:resolve` · `note:add` · `user:read` · `user:create` · `user:update` · `user:delete` ·
`role:read`

> Note: `visit:check_in`, `visit:check_out`, `visitor:register`, `invitation:create`, and
> `alert:escalate` are **defined but not yet consumed by any endpoint** — they map to the
> planned endpoints above.

Canonical roles (`ROLES`): `SUPER_ADMIN`, `ADMIN`, `AUDITOR`, `STAFF`, `VMC`, `GATE`.
</content>
