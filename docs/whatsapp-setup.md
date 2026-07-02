# WhatsApp Notifications — Setup & Testing

How to configure, run, and test the WhatsApp notification channel. WhatsApp is a
provider-swappable channel in the notification pipeline: pick a backend with
`WHATSAPP_PROVIDER` (`twilio` | `meta`), exactly like `EMAIL_PROVIDER` for email.

> Companion doc: [notifications.md](./notifications.md) (architecture, transports, localization).
> Env reference: [`apps/backend/.env.example`](../apps/backend/.env.example).

## How it fits together

Domain events (`visit.approved`, `visitor.checked_in`, `visitor.checked_out`)
enqueue a WhatsApp notification to the recipient's phone. The dispatcher renders
it and delivers via the selected provider:

```
WhatsappTransport (WHATSAPP_ENABLED, WHATSAPP_PROVIDER)
  ├─ TwilioWhatsappProvider    (reuses the shared Twilio client that backs SMS)
  ├─ MetaCloudWhatsappProvider (Meta WhatsApp Cloud API — direct Graph API)
  └─ LogWhatsappProvider       (fallback: logs instead of sending when unconfigured)
```

A channel that's enabled but unconfigured **logs** the message instead of
crashing, so the app always boots.

## Two things to know before you test

1. **Recipients need a phone number.** The listener sends WhatsApp to
   `visitor.phone` / `host.user.phone` (E.164, e.g. `+15551234567`). A visitor
   with no phone simply gets no WhatsApp message.
2. **Free text vs approved templates.** WhatsApp only allows *business-initiated*
   messages (all three VMS notifications) as **pre-approved templates (HSM)**
   outside a 24-hour window the user opens by messaging you first. Free text is
   silently undelivered in production.
   - `WHATSAPP_USE_TEMPLATES=false` (default) → free text. Works in the **Twilio
     sandbox** and within 24h sessions. Use this for testing.
   - `WHATSAPP_USE_TEMPLATES=true` → sends approved templates (requires template
     setup, see [Production](#production-approved-templates)).

---

## Option A — Twilio (default, fastest to test)

Reuses the same Twilio account that powers SMS.

### 1. Env (`apps/backend/.env`)

```bash
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=twilio
WHATSAPP_USE_TEMPLATES=false          # free text for sandbox testing

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=+14155238886     # Twilio sandbox number (see step 2)
```

`TWILIO_WHATSAPP_FROM` may be a bare `+E164` number — the transport prefixes
`whatsapp:` automatically.

### 2. Join the Twilio WhatsApp Sandbox (testing without an approved sender)

1. Twilio Console → **Messaging → Try it out → Send a WhatsApp message**.
2. Note the sandbox number (usually `+1 415 523 8886`) and your **join code**
   (e.g. `join <two-words>`).
3. From **each** test phone, send that `join <two-words>` message on WhatsApp to
   the sandbox number. Without this opt-in, Twilio rejects sends with error
   **63007 / 63016**.
4. Set that phone as the visitor/host phone you'll trigger notifications for.

### 3. Production sender (later)

For real sends you need a registered WhatsApp Business number: complete Meta
business verification and register the sender in Twilio
(**Messaging → Senders → WhatsApp senders**), then set `TWILIO_WHATSAPP_FROM` to
that number and use approved templates (`WHATSAPP_USE_TEMPLATES=true`).

---

## Option B — Meta WhatsApp Cloud API (direct, no BSP markup)

Talks to Meta's Graph API directly — the analogue of SendGrid's HTTP API vs SMTP.

### Prerequisites (Meta side)

1. A **Meta Business account** and a **Meta App** (developer.facebook.com) with
   the *WhatsApp* product added.
2. A **WhatsApp Business Account (WABA)** with a phone number registered.
3. The number's **phone-number ID** (WhatsApp → API Setup).
4. A **permanent System User access token** with `whatsapp_business_messaging`
   (Business Settings → System Users → generate token). Temporary tokens expire
   in ~24h — use a permanent one for anything beyond a quick test.

### Env (`apps/backend/.env`)

```bash
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=meta
WHATSAPP_USE_TEMPLATES=false          # free text only within a 24h session window

META_WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxx...   # permanent system-user token
META_WABA_PHONE_NUMBER_ID=1234567890
META_GRAPH_API_VERSION=v21.0          # optional; defaults to v21.0
```

For dev, add test recipient numbers under WhatsApp → API Setup (up to 5) so you
can send without a template.

---

## Run & test

1. **Start the backend** (make sure nothing else holds port 4000):

   ```bash
   npm run start:dev -w @vms/backend      # → http://localhost:4000
   ```

   Watch the first log lines. If it exits with `Invalid environment variables:`,
   an env value is missing/typo'd — the schema validates at boot
   (`shared/config/env.schema.ts`).

2. **Trigger a notification.** Any of the three lifecycle events sends WhatsApp
   to the recipient phone:
   - Approve a visit → `visit.approved` (to the visitor)
   - Check a visitor in → `visitor.checked_in` (to the host)
   - Check a visitor out → `visitor.checked_out` (to the visitor)

   Use a visit whose visitor/host phone is your opted-in sandbox (or Meta test)
   number.

3. **Confirm delivery.** The message should arrive on WhatsApp. Server-side, the
   `Notification` row moves `PENDING → SENT`; on failure it goes to `FAILED` and
   the dispatcher retries up to `NOTIFICATION_MAX_ATTEMPTS`.

### What you'll see in logs

| Log line | Meaning |
| --- | --- |
| `Sent WhatsApp to <n> via Twilio` / `via Meta Cloud API` | Delivered to the provider |
| `[whatsapp:log] to=… (… not configured — not actually sent)` | Provider unconfigured → fell back to logging (nothing sent) |
| `Meta WhatsApp send failed (401 …)` | Meta rejected it (bad/expired token, unverified recipient) — will retry |

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| No message arrives, logs show `[whatsapp:log] … not configured` | `TWILIO_WHATSAPP_FROM` (or Meta token/phone-number-id) unset → provider fell back to log. Fill the env and restart. |
| Nothing enqueued at all | `WHATSAPP_ENABLED` not `true`, or the recipient has no phone number. |
| Twilio error 63007 / 63016 | Test phone hasn't joined the sandbox — send the `join <code>` message first. |
| Twilio: free text fine in sandbox, fails on a real number | Business-initiated free text needs an approved template outside the 24h window. Set up templates and `WHATSAPP_USE_TEMPLATES=true`. |
| Meta 401 / 190 | Access token invalid or expired — use a permanent system-user token. |
| Meta 131030 / recipient not allowed | Recipient not in the app's allowed test list, or no approved template for a business-initiated message. |

## Production: approved templates

Once you have approved templates (Twilio Content Template / Meta Message
Template):

1. Add a `whatsappTemplate` to the relevant entry in `TEMPLATE_META`
   (`apps/backend/src/modules/notifications/notification.types.ts`):

   ```ts
   [NOTIFICATION_TEMPLATES.VISIT_APPROVED]: {
     emailFile: 'visit-approved',
     ns: 'visitApproved',
     withQr: true,
     whatsappTemplate: {
       name: 'visit_approved',   // Meta template name, OR Twilio Content SID (HX…)
       languageCode: 'en',       // defaults to the render locale if omitted
       vars: ['visitorName', 'visitDate', 'time'],  // payload keys → positional variables, in order
     },
   },
   ```

2. Set `WHATSAPP_USE_TEMPLATES=true`.

The transport then sends the approved template (Twilio `contentSid` +
`contentVariables`, or Meta `type: template` with body parameters); with the flag
off it keeps sending free text.

## Configuration reference

| Var | Purpose |
| --- | --- |
| `WHATSAPP_ENABLED` | Master toggle for the channel |
| `WHATSAPP_PROVIDER` (`twilio` \| `meta`) | Which backend to send through |
| `WHATSAPP_USE_TEMPLATES` | `false` = free text (sandbox/24h); `true` = approved templates |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio credentials (shared with SMS) |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp sender (sandbox or registered number) |
| `META_WHATSAPP_ACCESS_TOKEN` | Meta permanent system-user token |
| `META_WABA_PHONE_NUMBER_ID` | Meta sending number's phone-number ID |
| `META_GRAPH_API_VERSION` | Graph API version (default `v21.0`) |
