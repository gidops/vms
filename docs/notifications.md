# Notifications & Backend Localization

A production-grade, channel-pluggable notification system (In-App, Email, SMS, WhatsApp) that
reacts to visitor-lifecycle domain events and renders **localized** content per recipient. It also
completes backend localization: API error and validation messages are localized too, so the backend
is the single source of truth for localized rendering.

> Companion docs: [architecture.md](./architecture.md) (events/outbox), [api-inventory.md](./api-inventory.md).

## Architecture

```
Domain event (visit.approved / visitor.checked_in / visitor.checked_out)
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

- **Listener** (`notification.listener.ts`) — `@OnEvent` for the three lifecycle events. Loads the
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

| Event | Recipient(s) | Channels | Template | Contents |
| --- | --- | --- | --- | --- |
| `visit.approved` | Visitor (+ host in-app) | Email, SMS, WhatsApp, In-App | `visit.approved` | name, host, date/time, purpose, **access code**, **QR** (email) |
| `visitor.checked_in` | Host | Email, SMS, WhatsApp, In-App | `visitor.arrived` | guest name, time |
| `visitor.checked_out` | Visitor (+ host in-app) | Email, (SMS/WhatsApp), In-App | `visit.thank_you` | thank-you + **rating link** |

On approval, `VisitsService.approve()` also mints a `Pass` (access code) atomically, so the email/SMS
can include the code and an inline QR (generated from the code by `QrService`).

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
3. Register it in `TEMPLATE_META` (`notification.types.ts`) mapping the template key → `{ emailFile,
   ns, withQr? }`, and add the key to `NOTIFICATION_TEMPLATES`.

## Channels, providers & toggles

Each channel is independently toggleable via env — **no code change** to disable Email/SMS/WhatsApp.
A channel that's enabled but unconfigured logs the message (dev) instead of crashing.

| Channel | Transport | Provider(s) |
| --- | --- | --- |
| Email | `EmailTransport` | SMTP (`nodemailer` — Gmail/Mailtrap) or SendGrid; `EMAIL_PROVIDER` selects |
| SMS | `SmsTransport` | Twilio |
| WhatsApp | `WhatsappTransport` | Twilio (Business API) |
| In-App | (dispatcher) | the persisted row, read via the notifications API |

### Adding a new provider/channel

Implement `NotificationTransport` (`transports/transport.interface.ts`), register it in
`notifications.module.ts` and add it to the `NOTIFICATION_TRANSPORTS` factory. Business code is
untouched — swapping Twilio → Meta WhatsApp Cloud API is a transport-only change.

## In-app notifications API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/notifications?unreadOnly&page&pageSize` | Current user's in-app notifications (paginated) |
| `PATCH` | `/notifications/:id/read` | Mark one read |
| `POST` | `/notifications/read-all` | Mark all read |

## Localization

- **Catalogs**: `shared/i18n/messages/{en,fr,ar}.json` (namespaced: `errors.*`, `validation.*`,
  `email.*`, `sms.*`, `whatsapp.*`, `inapp.*`). `I18nService.translate(key, locale, vars)` with `{var}`
  interpolation and EN fallback.
- **Locale resolution per request**: the frontend sends `x-locale` (from next-intl). The CLS middleware
  stores it; the exception filter localizes API errors/validation; domain events carry `metadata.locale`.
- **Locale per notification**: the **recipient's** stored `preferredLocale` (`User`/`Visitor`) wins,
  then `metadata.locale`, then `NOTIFICATIONS_DEFAULT_LOCALE`. So an email/SMS is rendered in the
  recipient's language regardless of who triggered the event.
- **API errors**: `AllExceptionsFilter` translates exception messages that are catalog keys (e.g.
  `errors.visit.notFound`) and zod issues (`validation.<code>`); free-text messages pass through.

## Configuration

See [`apps/backend/.env.example`](../apps/backend/.env.example). Key vars:

| Var | Purpose |
| --- | --- |
| `EMAIL_ENABLED` / `SMS_ENABLED` / `WHATSAPP_ENABLED` / `INAPP_ENABLED` | Per-channel toggles |
| `NOTIFICATION_POLL_INTERVAL_MS` / `NOTIFICATION_MAX_ATTEMPTS` | Dispatcher cadence + retry cap |
| `NOTIFICATIONS_DEFAULT_LOCALE` | Fallback locale |
| `APP_PUBLIC_URL` | Builds the rating link |
| `EMAIL_PROVIDER` (`smtp`\|`sendgrid`), `EMAIL_FROM` | Email selection |
| `SMTP_HOST/PORT/SECURE/USER/PASS` | SMTP (Gmail/Mailtrap) |
| `SENDGRID_API_KEY` | SendGrid |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN/SMS_FROM/WHATSAPP_FROM` | Twilio SMS + WhatsApp |

**Gmail dev quickstart:** `EMAIL_PROVIDER=smtp`, `EMAIL_ENABLED=true`, `SMTP_HOST=smtp.gmail.com`,
`SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=<you@gmail.com>`, `SMTP_PASS=<app password>`.

## Notes & limits

- Two relays now poll Postgres (outbox + notifications) — fine at this scale.
- v1 sends the QR **image** in email only (inline CID). SMS/WhatsApp include the textual code; WhatsApp
  media needs a public URL (future).
- `Visitor.preferredLocale` defaults to `EN` until captured at registration/invitation time.
