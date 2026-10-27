# API

**Who this is for:** developers calling or changing the backend HTTP API, and
testers building API collections. **What you'll learn:** the conventions every
request follows, how login and tokens work, and the full list of endpoints with
who may call them.

The backend is a NestJS app. Locally its base URL is `http://localhost:4000`;
in AWS it is `https://api.<domain>`. There is no global path prefix or version
segment. Request and response shapes come from `@vms/contracts` (zod schemas),
which is the reference for field-level detail.

## Conventions

| Concern        | Detail                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication | Send `Authorization: Bearer <accessToken>` on every route except those marked **public**.                                                                                  |
| Authorization  | Routes may require **permissions** (`resource:action` keys such as `visit:approve`). Missing permission: `403`, and the denial is written to the audit log.                |
| Ownership      | Some routes also check that the caller created or hosts the visit. Where noted, a visit or alert you may not see returns `404`, not `403`, so its existence is not leaked. |
| Correlation    | Send `x-correlation-id` to trace a request through logs and the audit trail; one is generated if absent.                                                                   |
| Language       | Send `x-locale` (`en`, `fr`, `ar`); error messages come back translated.                                                                                                   |
| Validation     | Bodies and query strings are validated with zod; failures return `400` with the problems listed in `detail`.                                                               |
| Dates          | Business dates (exports, history ranges) are calendar days in West Africa Time (WAT).                                                                                      |

Errors use an RFC 7807-style body:

```json
{ "type": "about:blank", "title": "Unauthorized", "status": 401, "detail": "…" }
```

### Permissions and roles

Each role is a bundle of permissions; the access token carries the permissions
of the user's **active role** (plus any add-on roles). The mapping is in
`ROLE_DEFS` in `apps/backend/src/shared/auth/seeder.service.ts`; the System
Admin (`SUPER_ADMIN`) holds every permission. All permission keys are listed in
`PERMISSIONS` in `packages/contracts/src/auth/rbac.schema.ts`. A plain-language
version is in the [user guide](./user-guide.md#roles).

**"Reads all visits"** below means the caller has `visit:read` (System Admin,
Security Manager, VMC). As a temporary fallback the backend also treats the
active roles `SUPER_ADMIN`, `ADMIN` and `VMC` this way
(`shared/auth/visit-scope.ts`). Everyone else, such as staff, only sees visits
they created or host.

## Auth flow

1. `POST /auth/login` with `{ "email", "password" }`. Response:
   ```json
   {
     "user": {
       "id": "…",
       "email": "…",
       "fullName": "…",
       "roles": ["ADMIN"],
       "…": "…"
     },
     "tokens": {
       "accessToken": "<jwt>",
       "expiresIn": 3600,
       "tokenType": "Bearer"
     },
     "refreshToken": "<opaque>"
   }
   ```
2. Call APIs with the access token. `GET /users/me` returns the profile, roles
   and the active role's permissions.
3. When the access token expires (`401`), call `POST /auth/refresh` with
   `{ "refreshToken" }`. You get a new access token **and a new refresh token**;
   the old one is now used. Sending a used refresh token again returns `401` and
   revokes every token in that family (protection against stolen tokens).
4. `POST /auth/switch-role` with `{ "role" }` re-issues tokens for another role
   the user holds.
5. `POST /auth/logout` with `{ "refreshToken" }` ends the session.

First run: while no user exists, `POST /auth/signup` with
`{ "email", "fullName", "password" }` creates the first System Admin. After
that it returns `403` (audited as `auth.signup_blocked`).
`GET /auth/signup-available` tells the frontend whether to show the screen.

There is no rate limit on `/auth/login`; failed logins are audited.

Example:

```bash
curl -s -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.org","password":"<password>"}'

curl -s http://localhost:4000/users/me -H "Authorization: Bearer <accessToken>"
```

## Endpoints

85 routes across 16 controllers. "Signed-in" means any valid access token, no
specific permission. Where two permissions are listed with "+", both are
needed; "any of" means one is enough.

### Health

| Method | Path      | Access | Purpose                                                                                       |
| ------ | --------- | ------ | --------------------------------------------------------------------------------------------- |
| GET    | `/health` | public | Liveness. Always `200` with `{ status, database: "connected" \| "disconnected", timestamp }`. |

There is no `GET /` route.

### Auth (`/auth`)

| Method | Path                     | Access    | Purpose                                                          |
| ------ | ------------------------ | --------- | ---------------------------------------------------------------- |
| POST   | `/auth/login`            | public    | Log in; returns access and refresh tokens                        |
| POST   | `/auth/signup`           | public    | First-run creation of the System Admin; `403` once a user exists |
| GET    | `/auth/signup-available` | public    | Whether first-run signup is still open                           |
| POST   | `/auth/refresh`          | public    | Rotate the refresh token and get a new access token              |
| POST   | `/auth/switch-role`      | signed-in | Change the active role; re-issues tokens                         |
| POST   | `/auth/change-password`  | signed-in | Change own password (`204`); revokes all the user's sessions     |
| POST   | `/auth/logout`           | signed-in | Revoke the given refresh token (`204`)                           |

### Users and identity

| Method | Path                       | Access        | Purpose                                      |
| ------ | -------------------------- | ------------- | -------------------------------------------- |
| GET    | `/users/me`                | signed-in     | Own profile, roles and permissions           |
| PATCH  | `/users/me`                | signed-in     | Update own profile and preferences           |
| POST   | `/users/me/avatar/presign` | signed-in     | Get a pre-signed S3 upload URL for an avatar |
| PUT    | `/users/me/avatar`         | signed-in     | Save the uploaded avatar on the profile      |
| GET    | `/users/me/sessions`       | signed-in     | Own active sessions                          |
| GET    | `/users`                   | `user:read`   | Paginated user list                          |
| POST   | `/users`                   | `user:create` | Create a user                                |
| PATCH  | `/users/:id/roles`         | `user:update` | Replace a user's roles                       |
| DELETE | `/users/:id`               | `user:delete` | Delete a user (`204`)                        |
| GET    | `/roles`                   | `role:read`   | List role names                              |
| GET    | `/hosts`                   | signed-in     | Staff directory for the host picker          |

### Visits (`/visits`)

| Method | Path                                              | Access                                                                                        | Purpose                                                                               |
| ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `/visits`                                         | signed-in; own visits only unless the caller reads all visits                                 | Visit list (dashboard tables, approval queue, My Visits)                              |
| POST   | `/visits`                                         | `invitation:create`                                                                           | Create invites or walk-ins, one visit per guest. Walk-ins start approved.             |
| GET    | `/visits/:id`                                     | signed-in; without "reads all visits" or `history:read`, must be creator or host (else `404`) | Visit detail                                                                          |
| PATCH  | `/visits/:id`                                     | `visit:edit`; creator only, while Awaiting Approval or Needs More Info                        | Edit a request                                                                        |
| POST   | `/visits/:id/cancel`                              | `visit:cancel`; creator or host                                                               | Cancel                                                                                |
| POST   | `/visits/:id/resubmit`                            | `invitation:create`; host only                                                                | Resubmit after "more info" was requested; returns to Awaiting Approval                |
| POST   | `/visits/:id/resend-code`                         | `invitation:create`; host or creator; not for walk-ins                                        | Resend the guest's invite code and QR                                                 |
| POST   | `/visits/:id/approve`                             | `visit:approve`                                                                               | Approve                                                                               |
| POST   | `/visits/:id/deny`                                | `visit:deny`                                                                                  | Deny with a reason                                                                    |
| POST   | `/visits/bulk-approve`                            | `visit:approve`                                                                               | Approve several visits                                                                |
| POST   | `/visits/bulk-deny`                               | `visit:deny`                                                                                  | Deny several visits with one reason                                                   |
| POST   | `/visits/:id/flag`                                | `visit:flag`                                                                                  | Flag for security review: visit becomes FLAGGED, a SECURITY_REVIEW alert is raised    |
| POST   | `/visits/:id/request-info`                        | `visit:request_info`                                                                          | Ask for more info: visit becomes REVIEW_REQUESTED, an ADDITIONAL_INFO alert is raised |
| POST   | `/visits/:id/check-in`                            | `visit:check_in`                                                                              | Check in and assign a badge. Refused unless APPROVED with no open security alert.     |
| POST   | `/visits/:id/check-out`                           | `visit:check_out`                                                                             | Check out and release the badge                                                       |
| POST   | `/visits/:id/rating`                              | signed-in; host or creator; visit must be CHECKED_OUT                                         | Rate the visit 1–5                                                                    |
| GET    | `/visits/:id/notifications`                       | `notification:read`                                                                           | Email / SMS / WhatsApp delivery status for the visit                                  |
| POST   | `/visits/:id/notifications/:notificationId/retry` | `notification:read` + `notification:retry`                                                    | Re-queue a FAILED message                                                             |
| GET    | `/visits/evacuation-roll`                         | `evacuation:read`                                                                             | On-site visitors who need evacuation help                                             |
| GET    | `/visits/export`                                  | `report:export`                                                                               | Download visitor data as CSV or Excel (up to 366 WAT days); audited                   |
| GET    | `/visits/dashboard/stats`                         | `visit:approve`                                                                               | Admin console counts                                                                  |
| GET    | `/visits/dashboard/desk-stats`                    | `visit:check_in`                                                                              | VMC counts for today                                                                  |
| GET    | `/visits/dashboard/traffic`                       | `report:read`                                                                                 | Check-ins per hour                                                                    |

### Alerts (`/alerts`)

| Method | Path          | Access          | Purpose                                                                                                                                                     |
| ------ | ------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/alerts/:id` | signed-in       | Alert detail with visitor, visit and notes. Callers who read all visits see any alert; others only alerts on visits they created or host (otherwise `404`). |
| PATCH  | `/alerts/:id` | `alert:resolve` | Change status. Resolving or dismissing the last matching open alert lifts the hold: FLAGGED → APPROVED, REVIEW_REQUESTED → PENDING.                         |

### Requests & Alerts feed (`/inbox`)

| Method | Path                  | Access                                        | Purpose                                                 |
| ------ | --------------------- | --------------------------------------------- | ------------------------------------------------------- |
| GET    | `/inbox`              | signed-in; own visits unless reads all visits | Feed (`?kind=all\|requests\|alerts`, paged, searchable) |
| GET    | `/inbox/unread-count` | signed-in; same scope                         | Unread count for the nav badge                          |
| POST   | `/inbox/seen`         | signed-in                                     | Mark the feed read for the caller                       |

### Notes (`/notes`)

| Method | Path     | Access     | Purpose                                                    |
| ------ | -------- | ---------- | ---------------------------------------------------------- |
| POST   | `/notes` | `note:add` | Add a note to a visit or an alert (`visitId` or `alertId`) |

### In-app notifications (`/notifications`)

| Method | Path                      | Access               | Purpose                  |
| ------ | ------------------------- | -------------------- | ------------------------ |
| GET    | `/notifications`          | signed-in (own only) | Own in-app notifications |
| PATCH  | `/notifications/:id/read` | signed-in (own only) | Mark one read            |
| POST   | `/notifications/read-all` | signed-in (own only) | Mark all read            |

### Staff (`/staff`)

| Method | Path                     | Access                 | Purpose                  |
| ------ | ------------------------ | ---------------------- | ------------------------ |
| GET    | `/staff/dashboard/stats` | signed-in (own visits) | Staff home screen counts |
| GET    | `/staff/activity-feed`   | signed-in (own visits) | Staff Updates feed       |

### Insights (`/insights`)

With the first permission the data is facility-wide; with only `insights:self`
it covers the caller's own visits.

| Method | Path                     | Access                                 | Purpose                                            |
| ------ | ------------------------ | -------------------------------------- | -------------------------------------------------- |
| GET    | `/insights/overview`     | `overview:read`                        | Today's facility stats and who is on site          |
| GET    | `/insights/history`      | any of `history:read`, `insights:self` | Visit history                                      |
| GET    | `/insights/visitors`     | any of `visitor:read`, `insights:self` | Visitor directory                                  |
| GET    | `/insights/visitors/:id` | any of `visitor:read`, `insights:self` | One visitor and their visits                       |
| GET    | `/insights/analytics`    | any of `report:read`, `insights:self`  | Analytics; security figures only with `visit:flag` |

### Check-in badge pool (`/access-cards`)

| Method | Path            | Access           | Purpose                                                        |
| ------ | --------------- | ---------------- | -------------------------------------------------------------- |
| GET    | `/access-cards` | `visit:check_in` | Available badges for the check-in "Assign pass" list (by zone) |

### Personalised RFID cards (`/rfid-cards`), shown in the UI as Operations → Access cards

All routes need `rfid:manage` (System Admin only).

| Method | Path                                  | Purpose                                          |
| ------ | ------------------------------------- | ------------------------------------------------ |
| GET    | `/rfid-cards`                         | Card registry with current holder                |
| POST   | `/rfid-cards/:id/status`              | Set a card's status (found, reinstated, retired) |
| GET    | `/rfid-cards/assignments`             | List assignments                                 |
| GET    | `/rfid-cards/assignments/:id`         | One assignment                                   |
| POST   | `/rfid-cards/assignments`             | Assign a card to a visitor                       |
| PATCH  | `/rfid-cards/assignments/:id`         | Update an assignment (e.g. validity)             |
| POST   | `/rfid-cards/assignments/:id/printed` | Record a print or reprint                        |
| POST   | `/rfid-cards/assignments/:id/close`   | Close: card returned or lost                     |
| POST   | `/rfid-cards/photos/presign`          | Pre-signed S3 upload URL for the card photo      |

### Walk-in QR, admin side (`/desk-qr`)

| Method | Path               | Access          | Purpose                                   |
| ------ | ------------------ | --------------- | ----------------------------------------- |
| GET    | `/desk-qr`         | `issuer:read`   | Current QR settings, or `null`            |
| POST   | `/desk-qr`         | `issuer:manage` | Create the QR                             |
| PATCH  | `/desk-qr`         | `issuer:manage` | Change the inbox that receives codes      |
| POST   | `/desk-qr/rotate`  | `issuer:manage` | Replace the QR (old poster stops working) |
| POST   | `/desk-qr/disable` | `issuer:manage` | Disable                                   |
| POST   | `/desk-qr/enable`  | `issuer:manage` | Enable                                    |
| GET    | `/desk-qr/qr.png`  | `issuer:read`   | Download the QR image (`?size=` 256–2048) |

### Walk-in QR, public self-registration (`/public/desk-qr/:token`)

Public, rate-limited per IP and per QR, and the QR token is checked on every
call.

| Method | Path                                              | Limit                         | Purpose                                        |
| ------ | ------------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| GET    | `/public/desk-qr/:token`                          | 30/min per IP, 300/min per QR | Open a 10-minute form session                  |
| GET    | `/public/desk-qr/:token/hosts`                    | 60/min per IP                 | Host search (names and departments only)       |
| POST   | `/public/desk-qr/:token/registrations`            | 10/min per IP, 60/min per QR  | Submit the form; a code is emailed to the desk |
| POST   | `/public/desk-qr/:token/registrations/:id/verify` | 10/min per IP, 60/min per QR  | Check the code; creates today's walk-in        |

### Email consent (`/consent`)

| Method | Path                   | Access                            | Purpose                                   |
| ------ | ---------------------- | --------------------------------- | ----------------------------------------- |
| GET    | `/consent/opt-ins`     | `consent:read`                    | Consent list by current status            |
| GET    | `/consent/opt-ins.csv` | `consent:read` + `consent:export` | Download consented people as CSV; audited |
| POST   | `/consent/withdraw`    | `consent:manage`                  | Withdraw an email's consent               |
| POST   | `/consent/grant`       | `consent:grant`                   | Add consent back (System Admin)           |

### Audit trail (`/audit`)

| Method | Path                | Access                        | Purpose                                   |
| ------ | ------------------- | ----------------------------- | ----------------------------------------- |
| GET    | `/audit`            | `audit:read`                  | Filtered, paged audit log                 |
| GET    | `/audit/export.csv` | `audit:read` + `audit:export` | Download the filtered log as CSV; audited |

## Files and uploads

- **Downloads** (`Cache-Control: no-store`, file name in `Content-Disposition`):
  `GET /visits/export`, `GET /consent/opt-ins.csv`, `GET /audit/export.csv`,
  `GET /desk-qr/qr.png`.
- **Uploads** never pass through the API. The client asks for a pre-signed S3
  URL (`/users/me/avatar/presign`, `/rfid-cards/photos/presign`) and uploads
  directly to S3. These need `S3_BUCKET` to be set.
- There are no streaming (SSE) or multipart endpoints.

## Adding an endpoint

1. Define the request/response schema in `@vms/contracts` and rebuild
   (`npx turbo run build`).
2. Add the route to the module's controller with `@RequirePermissions(...)` (or
   `@Public()` with a reason).
3. Put the logic in a service; state changes go through
   `TransactionManager.run` + `EventPublisher.publish(tx, …)` so they are
   audited (see [architecture.md](./architecture.md)).
4. Add a co-located `*.spec.ts` and update the table above.
