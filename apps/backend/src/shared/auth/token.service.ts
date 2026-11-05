import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { Env } from '../config/env.schema';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
  activeRole?: string | null;
  /** Active role only, not the union of all roles. */
  permissions: string[];
  sid?: string;
  tenantId?: string | null;
  preferredLocale?: string;
}

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync(claims, {
      secret: this.config.get('JWT_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_EXPIRES_IN', { infer: true }),
    });
  }

  accessTokenTtlSeconds(): number {
    const raw = this.config.get('JWT_EXPIRES_IN', { infer: true });
    const match = /^(\d+)([smhd])$/.exec(raw);
    if (!match) return 900;
    return Number(match[1]) * (UNIT_SECONDS[match[2]] ?? 1);
  }

  /** The hash is deterministic so it can be queried. */
  generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('hex');
    return { token, hash: this.hashRefreshToken(token) };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
