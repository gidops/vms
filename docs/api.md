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
  { "type": "about:blank", "title": "Unauthorized", "status": 401,
    "detail": "…", "instance": "/auth/login", "timestamp": "<ISO>" }
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
  "user": { "id": "<uuid>", "email": "admin@aatc.org", "fullName": "AATC Admin",
            "preferredLocale": "EN", "roles": ["ADMIN"] },
  "tokens": { "accessToken": "<jwt>", "expiresIn": 3600, "tokenType": "Bearer" },
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
{ "id": "<uuid>", "email": "admin@aatc.org", "fullName": "AATC Admin",
  "preferredLocale": "EN", "roles": ["ADMIN"],
  "permissions": ["visit:approve", "visit:deny", "visit:check_in",
                  "visit:check_out", "visitor:register", "invitation:create",
                  "alert:escalate"] }
```

## Permissions (seeded)

`resource:action` keys; the `ADMIN` role holds all of them:

`visit:approve`, `visit:deny`, `visit:check_in`, `visit:check_out`,
`visitor:register`, `invitation:create`, `alert:escalate`.

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

Domain endpoints (Visitor Management, Gate Ops, Security, Staff/Host) are not yet
implemented — they will follow the same layered pattern and emit domain events
via the outbox. See [architecture.md](./architecture.md).
