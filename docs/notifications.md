# Notifications and backend localisation

**Who this is for:** backend developers and whoever configures email, SMS or
WhatsApp. **What you'll learn:** which messages the system sends and when, how
they are queued and retried, how templates and translations work, and how to set
up each channel, including WhatsApp.

The notification system sends In-App, Email, SMS and WhatsApp messages in
reaction to visit events, in the recipient's language. The backend also
translates its API error messages. Related docs:
[architecture.md](./architecture.md) (events and outbox), [api.md](./api.md).

## Architecture

```
Domain event (visit.approved / visit.invite_resent / visitor.checked_in / visitor.checked_out)
   │  OutboxRelay → EventEmitter2          (existing transactional outbox)
   ▼
NotificationListener (@OnEvent)            resolves recipients + locale + enabled channels
   ▼  one Notification row per channel (status = PENDING)
Notification table  ──poll──▶ NotificationDispatcher ──▶ TemplateService (MJML+Handlebars / i18n text)
                                     │                          + QrService (inline CID image)
                                     ▼
                        ChannelRegistry → Transport (Email | SMS | WhatsApp)   [IN_APP = the row itself]
                                     ▼ mark SENT / FAILED (+retry, exponential backoff)
```

Code lives in `apps/backend/src/modules/notifications/` (+ localization in `apps/backend/src/shared/i18n/`).

- **Listener** (`notification.listener.ts`) — `@OnEvent` for the four lifecycle events. Loads the
  visit/visitor/host, resolves the recipient locale, builds the template data, and enqueues.
- **Service** (`notification.service.ts`) — `enqueue()` writes one row per channel, skipping disabled
  channels and missing recipients; also serves the in-app API.
- **Dispatcher** (`notification.dispatcher.ts`) — polls `Notification` (the durable queue), renders +
  delivers, marks `SENT`/`FAILED` with backoff. Mirrors the existing `OutboxRelay`. Durable, survives
  restarts, no Redis.
- **TemplateService** (`templates/template.service.ts`) — renders per channel + locale.
- **Transports** (`transports/`) — `EmailTransport` (SMTP/SendGrid/Log), `SmsTransport`,
  `WhatsappTransport` (both Twilio). `ChannelRegistry` routes a channel → transport.

### Reliability

`Notification` is the queue: events enqueue `PENDING` rows atomically-downstream of the outbox; the
dispatcher delivers and retries with exponential backoff up to `NOTIFICATION_MAX_ATTEMPTS`, then marks
`FAILED`. A failure in one channel never affects others or the request path.

## Notification flows

| Event                 | Recipient(s)            | Channels                     | Template          | Contents                                                        |
| --------------------- | ----------------------- | ---------------------------- | ----------------- | --------------------------------------------------------------- |
| `visit.approved`      | Visitor (+ host in-app) | Email, SMS, WhatsApp, In-App | `visit.approved`  | name, host, date/time, purpose, **invite code**, **QR** (email) |
| `visit.invite_resent` | Visitor (+ host in-app) | Email, SMS, WhatsApp, In-App | `visit.approved`  | same as above ("Send CODE to guest")                            |
| `visitor.checked_in`  | Host                    | Email, SMS, WhatsApp, In-App | `visitor.arrived` | guest name, time                                                |
| `visitor.checked_out` | Visitor (+ host in-app) | Email, SMS, WhatsApp, In-App | `visit.thank_you` | thank-you + rating link                                         |
| Desk QR registration  | VMC desk inbox          | Email                        | `desk_qr.code`    | the 6-digit code reception reads to a self-registering visitor  |

Walk-ins get no invite email (they are approved at the desk). A walk-in with no
host produces no "visitor arrived" message. The code in the invite is the visit's
reference code (or the pass code as a fallback); the QR image is generated from
it by `QrService`. The desk code is sent directly by
`desk-qr/public-registration.service.ts`, not by the listener.

> Known gap: the thank-you rating link points to `${APP_PUBLIC_URL}/rating/<visitId>`,
> but the frontend has no `/rating` page. Rating is done by the host in the
> visit details (**Rate Guest**).

Each visit's delivery status is visible to roles with `notification:read` in the
visit details (**Notifications**), where failed messages can be retried
(`notification:retry`).

## Email templating — MJML + Handlebars

Templates live in `templates/email/*.mjml.hbs`:

- **MJML** gives responsive layout + automatic CSS inlining (handles email-client quirks).
- **Handlebars** injects variables and provides a `{{t 'key'}}` helper that pulls localized copy from
  the i18n catalogs — **templates carry no copy**, so designers edit structure without touching code
  and translators edit catalogs without touching templates.
- A reusable `layout.mjml.hbs` wraps each body via `{{{content}}}`.

Render pipeline: `Handlebars(template, data)` → MJML string → `mjml2html()` → responsive, inlined HTML.

> **Why not Pug / react-email?** Pug needs a separate CSS-inliner and isn't email-responsive; it's also
> less designer-friendly than HTML-like MJML. react-email would pull React into the NestJS backend and
> keeps copy in JSX. MJML+Handlebars best satisfies layouts, partials, localization, inline CSS, and
> low-effort future redesigns.

### Adding / editing a template

1. Add `templates/email/<name>.mjml.hbs` (and reuse `layout.mjml.hbs`).
2. Add the copy to `shared/i18n/messages/{en,fr,ar}.json` under `email.<ns>.*`, `sms.<ns>`,
   `whatsapp.<ns>`, `inapp.<ns>.*`.
3. Register it in `TEMPLATE_META` (`notification.types.ts`) mapping the template key →
   `{ emailFile, ns, withQr? }`, and add the key to `NOTIFICATION_TEMPLATES`.

## Channels, providers & toggles

Each channel is independently toggleable via env — **no code change** to disable Email/SMS/WhatsApp.
A channel that's enabled but unconfigured logs the message (dev) instead of crashing.

| Channel  | Transport           | Provider(s)                                                                                                                                                                                                                                                                                            |
| -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Email    | `EmailTransport`    | `EMAIL_PROVIDER` selects: `smtp`/`gmail`/`mailtrap` (nodemailer `SmtpProvider`, connection resolved from the selector) or `sendgrid` (HTTP API). Every transport's credentials can coexist in env — flip `EMAIL_PROVIDER` to switch, no code change. Falls back to the log provider when unconfigured. |
| SMS      | `SmsTransport`      | Twilio                                                                                                                                                                                                                                                                                                 |
| WhatsApp | `WhatsappTransport` | `WHATSAPP_PROVIDER` selects: `twilio` (`TwilioWhatsappProvider`, reuses the Twilio account/client that backs SMS) or `meta` (`MetaCloudWhatsappProvider`, Meta WhatsApp Cloud API via the Graph API). Falls back to the log provider when unconfigured.                                                |
| In-App   | (dispatcher)        | the persisted row, read via the notifications API                                                                                                                                                                                                                                                      |

WhatsApp needs extra setup; see [WhatsApp setup](#whatsapp-setup).

### Adding a new provider/channel

Implement `NotificationTransport` (`transports/transport.interface.ts`), register it in
`notifications.module.ts` and add it to the `NOTIFICATION_TRANSPORTS` factory. Business code is
untouched — swapping Twilio → Meta WhatsApp Cloud API is a transport-only change.

## In-app notifications API

| Method  | Path                                      | Description                                     |
| ------- | ----------------------------------------- | ----------------------------------------------- |
| `GET`   | `/notifications?unreadOnly&page&pageSize` | Current user's in-app notifications (paginated) |
| `PATCH` | `/notifications/:id/read`                 | Mark one read                                   |
| `POST`  | `/notifications/read-all`                 | Mark all read                                   |

## Localization

- **Catalogs**: `shared/i18n/messages/{en,fr,ar}.json` (namespaced: `errors.*`, `validation.*`,
  `email.*`, `sms.*`, `whatsapp.*`, `inapp.*`). `I18nService.translate(key, locale, vars)` with `{var}`
  interpolation and EN fallback.
- **Locale resolution per request**: the frontend sends `x-locale` (from next-intl). The CLS middleware
  stores it; the exception filter localizes API errors/validation; domain events carry `metadata.locale`.
- **Locale per notification**: the **recipient's** stored `preferredLocale` (`User`/`Visitor`) wins,
  then `metadata.locale`, then English. So an email/SMS is rendered in the
  recipient's language regardless of who triggered the event.
- **API errors**: `AllExceptionsFilter` translates exception messages that are catalog keys (e.g.
  `errors.visit.notFound`) and zod issues (`validation.<code>`); free-text messages pass through.

## Configuration

See [`apps/backend/.env.example`](../apps/backend/.env.example). Key vars:

| Var                                                                           | Purpose                                                                      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `EMAIL_ENABLED` / `SMS_ENABLED` / `WHATSAPP_ENABLED` / `INAPP_ENABLED`        | Per-channel toggles                                                          |
| `NOTIFICATION_POLL_INTERVAL_MS` / `NOTIFICATION_MAX_ATTEMPTS`                 | Dispatcher cadence + retry cap                                               |
| `APP_PUBLIC_URL`                                                              | Builds the rating link                                                       |
| `EMAIL_PROVIDER` (`smtp`\|`gmail`\|`mailtrap`\|`sendgrid`), `EMAIL_FROM`      | Email selection + sender                                                     |
| `SMTP_HOST/PORT/SECURE/USER/PASS`                                             | Generic/custom SMTP server (`EMAIL_PROVIDER=smtp`)                           |
| `GMAIL_USER/GMAIL_APP_PASSWORD`                                               | Gmail (`EMAIL_PROVIDER=gmail`; host/port/secure fixed to smtp.gmail.com:465) |
| `MAILTRAP_HOST/PORT/USER/PASS`                                                | Mailtrap live sending (`EMAIL_PROVIDER=mailtrap`)                            |
| `SENDGRID_API_KEY`                                                            | SendGrid HTTP API (`EMAIL_PROVIDER=sendgrid`)                                |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN/SMS_FROM/WHATSAPP_FROM`                        | Twilio SMS + WhatsApp (`twilio` provider)                                    |
| `WHATSAPP_PROVIDER` (`twilio`\|`meta`), `WHATSAPP_USE_TEMPLATES`              | WhatsApp backend selection + template mode                                   |
| `META_WHATSAPP_ACCESS_TOKEN/META_WABA_PHONE_NUMBER_ID/META_GRAPH_API_VERSION` | Meta WhatsApp Cloud API (`WHATSAPP_PROVIDER=meta`)                           |

**Switching transport:** set `EMAIL_ENABLED=true` and pick `EMAIL_PROVIDER`. Examples —
`gmail`: `GMAIL_USER=<you@gmail.com>`, `GMAIL_APP_PASSWORD=<app password>` (needs 2FA);
`mailtrap`: `MAILTRAP_USER`/`MAILTRAP_PASS` from the inbox's SMTP creds;
`sendgrid`: `SENDGRID_API_KEY=SG.…`. `EMAIL_FROM` must be a sender the active account is
authorized to send as (verified single sender / domain), or delivery is rejected.

In AWS, the email and WhatsApp settings come from `terraform/terraform.tfvars`
(see [operations.md](./operations.md#61-one-time-setup)).

## Notes & limits

- Two loops poll Postgres (outbox + notifications); fine at this scale.
- v1 sends the QR **image** in email only (inline CID). SMS/WhatsApp include the textual code; WhatsApp
  media needs a public URL (future).
- `Visitor.preferredLocale` defaults to `EN` until captured at registration/invitation time.

## WhatsApp setup

WhatsApp is a channel with two interchangeable providers, chosen with
`WHATSAPP_PROVIDER` (`twilio` or `meta`), the same way `EMAIL_PROVIDER` picks the
email provider.

```
WhatsappTransport (WHATSAPP_ENABLED, WHATSAPP_PROVIDER)
  ├─ TwilioWhatsappProvider    (reuses the Twilio client that backs SMS)
  ├─ MetaCloudWhatsappProvider (Meta WhatsApp Cloud API, direct Graph API calls)
  └─ LogWhatsappProvider       (fallback: logs instead of sending when unconfigured)
```

### Two things to know first

1. **Recipients need a phone number** in international (E.164) format, e.g.
   `+2348012345678`. A visitor or host without one gets no WhatsApp message.
2. **Free text vs approved templates.** WhatsApp only delivers messages a
   business starts (all VMS notifications) as **pre-approved templates** (also
   called HSM), unless the person messaged you in the last 24 hours. Free text
   outside that window is silently dropped.
   - `WHATSAPP_USE_TEMPLATES=false` (default): free text. Fine for the Twilio
     sandbox and testing.
   - `WHATSAPP_USE_TEMPLATES=true`: approved templates, needed in production
     (see [Approved templates](#approved-templates)).

### Option A: Twilio (quickest to test)

1. In `apps/backend/.env`:
   ```bash
   WHATSAPP_ENABLED=true
   WHATSAPP_PROVIDER=twilio
   WHATSAPP_USE_TEMPLATES=false
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_FROM=+14155238886     # Twilio sandbox number
   ```
   `TWILIO_WHATSAPP_FROM` can be a bare `+E164` number; the `whatsapp:` prefix is
   added automatically.
2. Join the sandbox: in the Twilio Console go to **Messaging → Try it out → Send
   a WhatsApp message**, note the sandbox number and join code, and send
   `join <two-words>` from **each** test phone. Without this Twilio rejects
   sends with error 63007 or 63016.
3. For production, register a WhatsApp Business sender in Twilio (needs Meta
   business verification), set `TWILIO_WHATSAPP_FROM` to it and use approved
   templates.

### Option B: Meta WhatsApp Cloud API

Prerequisites on the Meta side: a Meta Business account, a Meta App with the
WhatsApp product, a WhatsApp Business Account with a registered number, that
number's **phone-number ID**, and a **permanent System User access token** with
`whatsapp_business_messaging` (temporary tokens expire in about 24 hours).

```bash
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=meta
WHATSAPP_USE_TEMPLATES=false
META_WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxx...
META_WABA_PHONE_NUMBER_ID=1234567890
META_GRAPH_API_VERSION=v21.0          # optional, default v21.0
```

For testing, add up to five recipient numbers under WhatsApp → API Setup.

### Test it

1. Start the backend: `npm run start:dev -w @vms/backend`. If it exits with
   "Invalid environment variables", fix the named variable.
2. Trigger an event for a visit whose visitor or host phone is your test
   number: approve a visit (to the visitor), check the visitor in (to the host),
   or check them out (to the visitor).
3. The `Notification` row goes from `PENDING` to `SENT`, or to `FAILED` after
   `NOTIFICATION_MAX_ATTEMPTS` retries.

| Log line                                                     | Meaning                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `Sent WhatsApp to <n> via Twilio` / `via Meta Cloud API`     | Handed to the provider                                      |
| `[whatsapp:log] to=… (… not configured — not actually sent)` | Provider not configured; nothing was sent                   |
| `Meta WhatsApp send failed (401 …)`                          | Meta rejected it (bad token, unverified recipient); retries |

| Problem                                      | Fix                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Logs show `[whatsapp:log] … not configured`  | Sender number or Meta token / phone-number ID missing. Fill them in and restart.          |
| Nothing queued at all                        | `WHATSAPP_ENABLED` is not `true`, or the recipient has no phone number.                   |
| Twilio error 63007 / 63016                   | The phone has not joined the sandbox.                                                     |
| Works in the sandbox, fails on a real number | Outside the 24-hour window you need approved templates and `WHATSAPP_USE_TEMPLATES=true`. |
| Meta 401 / 190                               | Token invalid or expired; use a permanent system-user token.                              |
| Meta 131030 / recipient not allowed          | Recipient not in the test list, or no approved template.                                  |

### Approved templates

Once a template is approved (Twilio Content Template or Meta Message Template):

1. Add a `whatsappTemplate` to the matching entry in `TEMPLATE_META`
   (`apps/backend/src/modules/notifications/notification.types.ts`):
   ```ts
   [NOTIFICATION_TEMPLATES.VISIT_APPROVED]: {
     emailFile: 'visit-approved',
     ns: 'visitApproved',
     withQr: true,
     whatsappTemplate: {
       name: 'visit_approved',   // Meta template name, or Twilio Content SID (HX…)
       languageCode: 'en',       // defaults to the render locale if omitted
       vars: ['visitorName', 'visitDate', 'time'],  // payload keys, in template order
     },
   },
   ```
2. Set `WHATSAPP_USE_TEMPLATES=true`.
