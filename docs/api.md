# API

Backend HTTP API (NestJS, default base URL `http://localhost:4000`). Request and
response shapes derive from `@vms/contracts` (zod) where applicable.

## Conventions

- **Auth**: most routes require a Bearer access token
  (`Authorization: Bearer <accessToken>`). Routes marked **public** opt out via
  `@Public()`.
- **Authorization**: protected routes may require permissions
  (`@RequirePermissions('visit:approve')`), enforced by a global guard.
- **Correlation**: send `x-correlation-id` to trace a request across logs/audit;
  one is generated if absent.
- **Validation**: request bodies are validated with zod; failures return `400`.
- **Errors** (RFC‑7807‑style):
  ```json
  {
    "type": "about:blank",
    "title": "Unauthorized",
    "status": 401,
    "detail": "…",
    "instance": "/auth/login",
    "timestamp": "<ISO>"
  }
  ```

## Health

### `GET /` — public

Returns `"Hello World!"` (liveness).

### `GET /health` — public

```json
{ "status": "ok", "database": "connected", "timestamp": "<ISO>" }
```

`database` is `"connected"` | `"disconnected"` (pings the DB with `SELECT 1`).

## Auth

### `POST /auth/login` — public

Request:

```json
{ "email": "admin@aatc.org", "password": "Passw0rd!" }
```

Response `200`:

```json
{
  "user": {
    "id": "<uuid>",
    "email": "admin@aatc.org",
    "fullName": "AATC Admin",
    "preferredLocale": "EN",
    "roles": ["ADMIN"]
  },
  "tokens": {
    "accessToken": "<jwt>",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  },
  "refreshToken": "<opaque>"
}
```

`401` on invalid credentials. Emits a `auth.user_logged_in` domain event
(outbox → audit log).

### `POST /auth/refresh` — public

Request: `{ "refreshToken": "<opaque>" }` → same response shape as login, with a
**rotated** refresh token. Reusing an already‑used refresh token returns `401`
and revokes the token family.

### `POST /auth/logout`

Request: `{ "refreshToken": "<opaque>" }` → `204`. Revokes the token family and
its session.

## Users

### `GET /users/me` — requires auth

```json
{
  "id": "<uuid>",
  "email": "admin@aatc.org",
  "fullName": "AATC Admin",
  "preferredLocale": "EN",
  "roles": ["ADMIN"],
  "permissions": [
    "visit:approve",
    "visit:deny",
    "visit:check_in",
    "visit:check_out",
    "visitor:register",
    "invitation:create",
    "alert:escalate"
  ]
}
```

## Requests & Alerts

The "Requests & Alerts" inbox unifies **visit requests** (a `Visit`) and
**alerts** (a flagged‑visitor `Alert`). State‑changing routes go through the
transactional outbox (→ audit log) and are permission‑guarded.

### `GET /inbox?kind=all|requests|alerts&page&pageSize&search` — requires auth

Unified, recency‑sorted, paginated feed. Returns `Paginated<InboxItem>` where each
item is a discriminated union on `kind`:

```json
{
  "items": [
    {
      "kind": "request",
      "id": "<uuid>",
      "visitId": "<uuid>",
      "status": "PENDING",
      "title": "Visit Request from Dr Alabi",
      "description": "Visit request for Mr Jude from",
      "organization": "Standard Chartered Bank",
      "createdByName": "AATC Admin",
      "notesCount": 2,
      "createdAt": "<ISO>"
    },
    {
      "kind": "alert",
      "id": "<uuid>",
      "alertId": "<uuid>",
      "status": "OPEN",
      "level": "HIGH",
      "title": "Flagged Visitor Match",
      "description": "…",
      "organization": null,
      "createdByName": "AATC Admin",
      "notesCount": 0,
      "createdAt": "<ISO>"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 5,
  "totalPages": 1
}
```

### `GET /visits/:id` — requires auth

Full `VisitRequestDetail` (visit + visitor + host→user + notes + `createdByName`/`source`).

### `POST /visits/:id/cancel` — `visit:cancel`

Sets status `CANCELLED`; emits `visit.cancelled`. Returns the updated detail.

### `PATCH /visits/:id` — `visit:edit`

Body: `{ "purpose"?: string, "scheduledAt"?: <ISO> }`; emits `visit.updated`.

### `POST /visits/:id/approve` — `visit:approve`

Sets `APPROVED` + `approvedById`; emits `visit.approved`.

### `POST /visits/:id/deny` — `visit:deny`

Body: `{ "reason": string }` → `DENIED` + `deniedReason`; emits `visit.denied`.

### `GET /alerts/:id` — requires auth

`AlertWithVisitor` (+ notes).

### `PATCH /alerts/:id` — `alert:resolve`

Body: `{ "status": "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED" }`; emits `alert.updated`.

### `POST /notes` — `note:add`

Body: `{ "visitId"?: <uuid>, "alertId"?: <uuid>, "body": string }` (exactly one
target). Creates a `Note`; emits `note.added`.

## Permissions (seeded)

`resource:action` keys. Seeded roles: **ADMIN** (all), **CSO** (`visit:approve`,
`visit:deny`, `alert:resolve`, `alert:escalate`, `note:add`), **RECEPTION**
(`visitor:register`, `invitation:create`, `visit:cancel`, `visit:edit`, `note:add`).

Full key set: `visit:approve`, `visit:deny`, `visit:cancel`, `visit:edit`,
`visit:check_in`, `visit:check_out`, `visitor:register`, `invitation:create`,
`alert:escalate`, `alert:resolve`, `note:add`.

## Example

```bash
# login
curl -s -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@aatc.org","password":"Passw0rd!"}'

# call a protected endpoint
curl -s http://localhost:4000/users/me \
  -H "Authorization: Bearer <accessToken>"
```

## Roadmap

The Requests & Alerts slice (inbox / visits / alerts / notes) is implemented.
Remaining domain endpoints (visitor registration, gate ops, pass issuance, a
visits **list** for the dashboard) are not yet built — they follow the same
layered pattern and emit domain events via the outbox. See
[architecture.md](./architecture.md).
