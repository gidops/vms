import { z } from 'zod';

/** Treat blank .env values (`KEY=`) as unset so defaults/optional apply. */
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

const boolEnv = (def: boolean) =>
  z
    .preprocess(
      (v) => (v === '' || v == null ? String(def) : v),
      z.enum(['true', 'false']),
    )
    .transform((v) => v === 'true');

/** Validated at boot so a missing or mistyped variable fails fast. */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // A hop count, never `true`: trusting all of X-Forwarded-For lets clients dodge per-IP rate limits.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().min(1).default('1h'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  // base64 32-byte key; derived from JWT_SECRET in dev if absent.
  ENCRYPTION_KEY: z.string().optional(),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  SEED_DEMO_DATA: boolEnv(false),
  // Delete roles the code no longer defines (and their user assignments) on boot.
  SEED_PRUNE_ROLES: boolEnv(false),
  SEQ_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SEQ_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  // Optional so the app boots without S3; credentials come from the AWS default chain.
  AWS_REGION: z.preprocess(emptyToUndefined, z.string().default('us-east-1')),
  S3_BUCKET: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_PRESIGN_EXPIRY: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(300),
  ),

  // An enabled-but-unconfigured channel logs instead of failing.
  EMAIL_ENABLED: boolEnv(false),
  SMS_ENABLED: boolEnv(false),
  WHATSAPP_ENABLED: boolEnv(false),
  INAPP_ENABLED: boolEnv(true),
  NOTIFICATION_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  APP_PUBLIC_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default('http://localhost:3000'),
  ),

  EMAIL_PROVIDER: z
    .enum(['smtp', 'gmail', 'mailtrap', 'sendgrid'])
    .default('smtp'),
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(587),
  ),
  SMTP_SECURE: boolEnv(false),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  GMAIL_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  GMAIL_APP_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
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
  SENDGRID_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

  TWILIO_ACCOUNT_SID: z.preprocess(emptyToUndefined, z.string().optional()),
  TWILIO_AUTH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  TWILIO_SMS_FROM: z.preprocess(emptyToUndefined, z.string().optional()),
  TWILIO_WHATSAPP_FROM: z.preprocess(emptyToUndefined, z.string().optional()),

  WHATSAPP_PROVIDER: z.enum(['twilio', 'meta']).default('twilio'),
  WHATSAPP_USE_TEMPLATES: boolEnv(false),
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
