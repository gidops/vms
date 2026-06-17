import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import type { Env } from '../config/env.schema';

/**
 * AES-256-GCM authenticated encryption for PII / biometric references stored at
 * rest (e.g. Visitor.phone, ShiftAttendance.fingerprintTemplateRef). Output is
 * `iv.tag.ciphertext` (base64 parts). The key comes from ENCRYPTION_KEY (base64,
 * 32 bytes); in dev it is derived deterministically from JWT_SECRET.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const configured = config.get('ENCRYPTION_KEY', { infer: true });
    if (configured) {
      this.key = Buffer.from(configured, 'base64');
      if (this.key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must decode to 32 bytes (base64).');
      }
    } else {
      const secret = config.get('JWT_SECRET', { infer: true });
      this.key = scryptSync(secret, 'vms-encryption-salt', 32);
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Invalid ciphertext format.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
