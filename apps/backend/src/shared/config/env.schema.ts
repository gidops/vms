import { z } from 'zod';

/** Treat blank .env values (`KEY=`) as unset so defaults/optional apply. */
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

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
