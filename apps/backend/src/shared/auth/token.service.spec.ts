import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.schema';
import { TokenService } from './token.service';

function makeConfig(values: Record<string, string>): ConfigService<Env, true> {
  return {
    get: (k: string) => values[k],
  } as unknown as ConfigService<Env, true>;
}

const baseConfig = { JWT_SECRET: 'secret', JWT_EXPIRES_IN: '1h' };

describe('TokenService', () => {
  it('hashes refresh tokens deterministically (sha256 hex)', () => {
    const svc = new TokenService({} as JwtService, makeConfig(baseConfig));
    const h1 = svc.hashRefreshToken('abc');
    const h2 = svc.hashRefreshToken('abc');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a token whose hash matches hashRefreshToken', () => {
    const svc = new TokenService({} as JwtService, makeConfig(baseConfig));
    const { token, hash } = svc.generateRefreshToken();
    expect(svc.hashRefreshToken(token)).toBe(hash);
  });

  it('parses JWT_EXPIRES_IN into seconds (with a safe fallback)', () => {
    const ttl = (exp: string) =>
      new TokenService(
        {} as JwtService,
        makeConfig({ ...baseConfig, JWT_EXPIRES_IN: exp }),
      ).accessTokenTtlSeconds();
    expect(ttl('15m')).toBe(900);
    expect(ttl('2h')).toBe(7200);
    expect(ttl('7d')).toBe(604800);
    expect(ttl('garbage')).toBe(900);
  });

  it('signs an access token via JwtService with secret + expiry', async () => {
    const signAsync = jest.fn().mockResolvedValue('jwt-token');
    const svc = new TokenService(
      { signAsync } as unknown as JwtService,
      makeConfig(baseConfig),
    );
    const claims = {
      sub: 'u',
      email: 'e',
      roles: [],
      permissions: [],
    } as never;

    await expect(svc.signAccessToken(claims)).resolves.toBe('jwt-token');
    expect(signAsync).toHaveBeenCalledWith(
      claims,
      expect.objectContaining({ secret: 'secret', expiresIn: '1h' }),
    );
  });
});
