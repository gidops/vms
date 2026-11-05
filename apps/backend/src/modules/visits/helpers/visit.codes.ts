import { randomInt } from 'node:crypto';

export const PASS_TTL_MS = 24 * 60 * 60 * 1000;

/** Unambiguous alphabet (no O/0/1/I) for human-read codes. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAccessCode(): string {
  const digits = String(randomInt(1000, 10000));
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `${digits}-${suffix}`;
}

/** Guest-facing reference encoded in the invite QR, e.g. "5A19-795". */
export function generateReferenceCode(): string {
  let prefix = '';
  for (let i = 0; i < 4; i++) {
    prefix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `${prefix}-${String(randomInt(100, 1000))}`;
}
