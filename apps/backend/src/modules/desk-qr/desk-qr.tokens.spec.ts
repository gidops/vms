import { DESK_QR_TOKEN_RE } from '@vms/contracts';
import {
  formTokenValid,
  hashVerificationCode,
  newDeskToken,
  newVerificationCode,
  parseV1Token,
  signFormToken,
  verificationCodeMatches,
} from './desk-qr.tokens';

const SECRET = 'test-secret';

describe('desk QR tokens', () => {
  it('makes unguessable URL-safe tokens the public route accepts', () => {
    const a = newDeskToken();
    expect(a).toMatch(DESK_QR_TOKEN_RE);
    expect(a).toHaveLength(22);
    expect(newDeskToken()).not.toBe(a);
  });

  it('reads a V1 token from the printed URL or on its own', () => {
    const hex = '0B8320CA0B0B12F1A9D0628DD18A9D48';
    expect(parseV1Token(`https://aatcabuja.com.ng/qr.php?i=${hex}`)).toBe(
      hex.toLowerCase(),
    );
    expect(parseV1Token(hex)).toBe(hex.toLowerCase());
    expect(parseV1Token(hex.toLowerCase())).toMatch(DESK_QR_TOKEN_RE);
    expect(parseV1Token('https://aatcabuja.com.ng/qr.php?i=nope')).toBeNull();
    expect(parseV1Token('not a url')).toBeNull();
  });
});

describe('form tokens', () => {
  const now = new Date('2026-10-19T10:00:00Z');
  const in10 = new Date(now.getTime() + 10 * 60_000);

  it('accepts its own token until it expires', () => {
    const t = signFormToken(SECRET, 'qr1', in10);
    expect(formTokenValid(SECRET, 'qr1', t, now)).toEqual({ ok: true });
    expect(
      formTokenValid(SECRET, 'qr1', t, new Date(in10.getTime() + 1)),
    ).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a token for another QR, a tampered expiry or junk', () => {
    const t = signFormToken(SECRET, 'qr1', in10);
    expect(formTokenValid(SECRET, 'rotated', t, now).ok).toBe(false);
    const [, sig] = t.split('.');
    const later = `${in10.getTime() + 3_600_000}.${sig}`;
    expect(formTokenValid(SECRET, 'qr1', later, now)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(formTokenValid(SECRET, 'qr1', 'junk', now).ok).toBe(false);
  });
});

describe('verification codes', () => {
  it('are six digits', () => {
    for (let i = 0; i < 50; i++)
      expect(newVerificationCode()).toMatch(/^\d{6}$/);
  });

  it('match only the same code for the same registration', () => {
    const hash = hashVerificationCode(SECRET, 'r1', '004219');
    expect(verificationCodeMatches(SECRET, 'r1', '004219', hash)).toBe(true);
    expect(verificationCodeMatches(SECRET, 'r1', '004218', hash)).toBe(false);
    expect(verificationCodeMatches(SECRET, 'r2', '004219', hash)).toBe(false);
    expect(verificationCodeMatches('other', 'r1', '004219', hash)).toBe(false);
  });
});
