import { z } from 'zod';

/** Treat blank .env values (`KEY=`) as unset so defaults/optional apply. */
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

/** A boolean feature flag from env ("true"/"false"), with a default. */
const boolEnv = (def: boolean) =>
  z
    .preprocess(
      (v) => (v === '' || v == null ? String(def) : v),
      z.enum(['true', 'false']),
    )
    .transform((v) => v === 'true');

/**
 * Environment contract for the backend. Validated at boot so the process fails
 * fast (with a readable message) rather than crashing later on a missing/typo'd
 * variable. Unknown env vars are ignored.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().min(1).default('1h'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  // base64-encoded 32-byte key for column encryption; derived from JWT_SECRET in dev if absent.
  ENCRYPTION_KEY: z.string().optional(),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  // Seq structured-log / audit mirror (optional). When SEQ_URL is set, audit
  // events are mirrored to Seq for searchable trails; PostgreSQL stays the
  // source of truth. Blank values are treated as unset (mirroring disabled).
  SEQ_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SEQ_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  // S3 avatar uploads. Optional so the app boots without S3 configured (dev);
  // the presign route errors clearly when S3_BUCKET is unset. AWS credentials
  // come from the default provider chain (env vars locally, IAM role in prod).
  // Blank values in .env are treated as unset (so defaults/optional apply).
  AWS_REGION: z.preprocess(emptyToUndefined, z.string().default('us-east-1')),
  S3_BUCKET: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_PRESIGN_EXPIRY: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(300),
  ),

  // ── Notifications ──────────────────────────────────────────────────────────
  // Per-channel feature toggles. A disabled channel is never enqueued or sent;
  // an enabled-but-unconfigured channel logs instead of failing (LogTransport).
  EMAIL_ENABLED: boolEnv(false),
  SMS_ENABLED: boolEnv(false),
  WHATSAPP_ENABLED: boolEnv(false),
  INAPP_ENABLED: boolEnv(true),
  // Polling dispatcher (Notification table acts as the durable queue).
  NOTIFICATION_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  NOTIFICATIONS_DEFAULT_LOCALE: z.enum(['EN', 'FR', 'AR']).default('EN'),
  // Public URL of the frontend (used to build the rating/feedback link).
  APP_PUBLIC_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default('http://localhost:3000'),
  ),

  // Email transport. EMAIL_PROVIDER selects the implementation; falls back to a
  // log transport when the chosen provider isn't configured. `gmail`, `mailtrap`
  // and `smtp` all run through the nodemailer SmtpProvider (which resolves its
  // connection from the selector); `sendgrid` uses the SendGrid HTTP API. This
  // lets every transport's credentials coexist in env and be switched by flipping
  // this one variable.
  EMAIL_PROVIDER: z
    .enum(['smtp', 'gmail', 'mailtrap', 'sendgrid'])
    .default('smtp'),
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().optional()),
  // Generic/custom SMTP server.
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(587),
  ),
  SMTP_SECURE: boolEnv(false),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  // Gmail (host/port/secure are fixed to smtp.gmail.com:465; use an app password).
  GMAIL_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  GMAIL_APP_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  // Mailtrap (live SMTP sending).
  MAILTRAP_HOST: z.preprocess(
    emptyToUndefined,
    z.string().default('live.smtp.mailtrap.io'),
  ),
  MAILTRAP_PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(2525),
  ),
  MAILTRAP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  MAILTRAP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  // SendGrid HTTP API (the SG.* value is the API key).
  SENDGRID_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

  // SMS via Twilio (one Twilio account also serves the WhatsApp `twilio` provider).
  TWILIO_ACCOUNT_SID: z.preprocess(emptyToUndefined, z.string().optional()),
  TWILIO_AUTH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  TWILIO_SMS_FROM: z.preprocess(emptyToUndefined, z.string().optional()),
  TWILIO_WHATSAPP_FROM: z.preprocess(emptyToUndefined, z.string().optional()),

  // WhatsApp transport. WHATSAPP_PROVIDER selects the backend (mirrors
  // EMAIL_PROVIDER): `twilio` (BSP, reuses the Twilio account above) or `meta`
  // (Meta WhatsApp Cloud API, direct Graph API — no middleman). Falls back to a
  // log provider when the chosen backend isn't configured, so enabling WhatsApp
  // never breaks boot. WHATSAPP_USE_TEMPLATES=false sends free text (works in the
  // Twilio sandbox and within 24h sessions); set true once approved templates
  // (HSM) exist, required for proactive production sends.
  WHATSAPP_PROVIDER: z.enum(['twilio', 'meta']).default('twilio'),
  WHATSAPP_USE_TEMPLATES: boolEnv(false),
  // Meta WhatsApp Cloud API (WHATSAPP_PROVIDER=meta). Token is a permanent
  // system-user access token; phone-number-id identifies the sending number.
  META_WHATSAPP_ACCESS_TOKEN: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  META_WABA_PHONE_NUMBER_ID: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  META_GRAPH_API_VERSION: z.preprocess(
    emptyToUndefined,
    z.string().default('v21.0'),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(
        (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
