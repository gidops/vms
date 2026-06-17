import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Env } from '../config/env.schema';
import { EncryptionService } from './encryption.service';

function makeConfig(
  values: Record<string, string | undefined>,
): ConfigService<Env, true> {
  return {
    get: (k: string) => values[k],
  } as unknown as ConfigService<Env, true>;
}

describe('EncryptionService', () => {
  const key = randomBytes(32).toString('base64');

  it('round-trips plaintext with an explicit 32-byte key', () => {
    const svc = new EncryptionService(makeConfig({ ENCRYPTION_KEY: key }));
    const ciphertext = svc.encrypt('national-id-123');
    expect(ciphertext).not.toContain('national-id-123');
    expect(svc.decrypt(ciphertext)).toBe('national-id-123');
  });

  it('produces a fresh IV per call (ciphertexts differ)', () => {
    const svc = new EncryptionService(makeConfig({ ENCRYPTION_KEY: key }));
    expect(svc.encrypt('same')).not.toBe(svc.encrypt('same'));
  });

  it('derives a key from JWT_SECRET when ENCRYPTION_KEY is absent', () => {
    const svc = new EncryptionService(makeConfig({ JWT_SECRET: 'dev-secret' }));
    expect(svc.decrypt(svc.encrypt('x'))).toBe('x');
  });

  it('rejects a tampered ciphertext (GCM auth tag)', () => {
    const svc = new EncryptionService(makeConfig({ ENCRYPTION_KEY: key }));
    const [iv, tag] = svc.encrypt('secret').split('.');
    const tampered = Buffer.from('different-bytes', 'utf8').toString('base64');
    expect(() => svc.decrypt([iv, tag, tampered].join('.'))).toThrow();
  });

  it('throws on malformed ciphertext', () => {
    const svc = new EncryptionService(makeConfig({ ENCRYPTION_KEY: key }));
    expect(() => svc.decrypt('not-valid')).toThrow(
      'Invalid ciphertext format.',
    );
  });

  it('rejects a key that does not decode to 32 bytes', () => {
    const shortKey = randomBytes(16).toString('base64');
    expect(
      () => new EncryptionService(makeConfig({ ENCRYPTION_KEY: shortKey })),
    ).toThrow('ENCRYPTION_KEY must decode to 32 bytes (base64).');
  });
});
