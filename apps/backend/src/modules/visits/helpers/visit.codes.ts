import { randomInt } from 'node:crypto';

/** A freshly-minted pass is valid for 24h from the scheduled/check-in time. */
export const PASS_TTL_MS = 24 * 60 * 60 * 1000;

/** Unambiguous alphabet (no O/0/1/I) for human-read codes. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Internal pass code, e.g. "4486-BC9C" (digits-dash-alnum). */
export function generateAccessCode(): string {
  const digits = String(randomInt(1000, 10000));
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `${digits}-${suffix}`;
}

/**
 * Guest-facing invite reference code, e.g. "5A19-795" (4 alnum - 3 digits).
 * Encoded in the invite QR and printed on the success/check-in screens so the
 * VMC operator can match it against the code in the visitor's email.
 */
export function generateReferenceCode(): string {
  let prefix = '';
  for (let i = 0; i < 4; i++) {
    prefix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `${prefix}-${String(randomInt(100, 1000))}`;
}
