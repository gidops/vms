import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/** A fresh printed-URL token: 128 random bits, URL-safe (22 chars). */
export function newDeskToken(): string {
  return randomBytes(16).toString('base64url');
}

const V1_TOKEN_RE = /^[0-9a-f]{32}$/i;

/**
 * The token from a V1 issuer QR, given either the bare 32-hex token or the
 * printed URL (`https://aatcabuja.com.ng/qr.php?i=<hex32>`). Null if neither.
 */
export function parseV1Token(input: string): string | null {
  const raw = input.trim();
  if (V1_TOKEN_RE.test(raw)) return raw.toLowerCase();
  try {
    const i = new URL(raw).searchParams.get('i') ?? '';
    return V1_TOKEN_RE.test(i) ? i.toLowerCase() : null;
  } catch {
    return null;
  }
}

function hmac(secret: string, value: string): Buffer {
  return createHmac('sha256', secret).update(value).digest();
}

function sameBytes(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Sign "this form was opened for this QR until `expiresAt`". Tied to the
 * current token, so rotating the QR also invalidates forms already open.
 */
export function signFormToken(
  secret: string,
  deskQrToken: string,
  expiresAt: Date,
): string {
  const exp = expiresAt.getTime();
  const sig = hmac(secret, `form:${deskQrToken}:${exp}`).toString('base64url');
  return `${exp}.${sig}`;
}

/** Whether a form token is ours for this QR and still open at `now`. */
export function formTokenValid(
  secret: string,
  deskQrToken: string,
  formToken: string,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: 'invalid' | 'expired' } {
  const [expRaw, sig] = formToken.split('.');
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !sig) return { ok: false, reason: 'invalid' };
  const expected = hmac(secret, `form:${deskQrToken}:${exp}`);
  if (!sameBytes(expected, Buffer.from(sig, 'base64url'))) {
    return { ok: false, reason: 'invalid' };
  }
  return exp > now.getTime() ? { ok: true } : { ok: false, reason: 'expired' };
}

/** A 6-digit verification code, zero-padded. */
export function newVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Keyed hash of a code, bound to its registration so a stored hash can't be
 * reused for another one or reversed by trying all million codes offline.
 */
export function hashVerificationCode(
  secret: string,
  registrationId: string,
  code: string,
): string {
  return hmac(secret, `code:${registrationId}:${code}`).toString('hex');
}

export function verificationCodeMatches(
  secret: string,
  registrationId: string,
  code: string,
  storedHash: string,
): boolean {
  return sameBytes(
    Buffer.from(hashVerificationCode(secret, registrationId, code), 'hex'),
    Buffer.from(storedHash, 'hex'),
  );
}
