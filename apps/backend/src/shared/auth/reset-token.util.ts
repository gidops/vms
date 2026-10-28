import { createHash, randomBytes } from 'node:crypto';

/**
 * Password-reset link lifetime. Short on purpose: the link lands in an inbox
 * (and its raw token in the Notification payload), so the exposure window is
 * the main mitigation. An admin can always send a fresh link.
 */
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

/** The raw token travels only inside the emailed link; the DB keeps the hash. */
export function generateResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashResetToken(token) };
}

/** Deterministic (like refresh tokens) so the row can be queried by hash. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
