import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_KEY,
  RateLimitGuard,
  type RateLimitRule,
} from './rate-limit.guard';

function context(rules: RateLimitRule[], ip: string, token = 't1') {
  const handler = () => undefined;
  Reflect.defineMetadata(RATE_LIMIT_KEY, rules, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ ip, params: { token } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  afterEach(() => jest.useRealTimers());

  it('allows up to the limit per IP, then answers 429 with a retry hint', () => {
    const guard = new RateLimitGuard(new Reflector());
    const rules: RateLimitRule[] = [
      { name: 'a', limit: 2, windowMs: 60_000, by: 'ip' },
    ];
    expect(guard.canActivate(context(rules, '1.1.1.1'))).toBe(true);
    expect(guard.canActivate(context(rules, '1.1.1.1'))).toBe(true);
    try {
      guard.canActivate(context(rules, '1.1.1.1'));
      throw new Error('expected a 429');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(429);
      expect((err as HttpException).getResponse()).toMatchObject({
        message: 'errors.rateLimited',
      });
    }
    // Another address has its own window.
    expect(guard.canActivate(context(rules, '2.2.2.2'))).toBe(true);
  });

  it('counts by a route param across addresses', () => {
    const guard = new RateLimitGuard(new Reflector());
    const rules: RateLimitRule[] = [
      { name: 'tok', limit: 1, windowMs: 60_000, by: { param: 'token' } },
    ];
    expect(guard.canActivate(context(rules, '1.1.1.1', 'abc'))).toBe(true);
    expect(() => guard.canActivate(context(rules, '9.9.9.9', 'abc'))).toThrow(
      HttpException,
    );
    expect(guard.canActivate(context(rules, '9.9.9.9', 'other'))).toBe(true);
  });

  it('starts a fresh window once the old one ends', () => {
    jest.useFakeTimers({ now: 0 });
    const guard = new RateLimitGuard(new Reflector());
    const rules: RateLimitRule[] = [
      { name: 'w', limit: 1, windowMs: 1_000, by: 'ip' },
    ];
    expect(guard.canActivate(context(rules, 'x'))).toBe(true);
    expect(() => guard.canActivate(context(rules, 'x'))).toThrow();
    jest.setSystemTime(1_001);
    expect(guard.canActivate(context(rules, 'x'))).toBe(true);
  });

  it('lets routes without rules through', () => {
    const guard = new RateLimitGuard(new Reflector());
    expect(guard.canActivate(context([], 'x'))).toBe(true);
  });
});

describe('RateLimitGuard memory bounds', () => {
  const byToken: RateLimitRule[] = [
    {
      name: 'qr',
      limit: 3,
      windowMs: 60_000,
      by: { param: 'token', pattern: /^[a-z]{4}$/ },
    },
  ];

  it('puts tokens that fail the pattern in one shared bucket', () => {
    const guard = new RateLimitGuard(new Reflector());
    for (let i = 0; i < 3; i++) {
      guard.canActivate(
        context(byToken, `ip${i}`, `junk-${i}-${'x'.repeat(i)}`),
      );
    }
    expect(guard.size).toBe(1);
    // The shared bucket is limited like any other, so floods still get 429s.
    expect(() =>
      guard.canActivate(context(byToken, 'ip9', 'junk-again')),
    ).toThrow(HttpException);
    // A well-formed token keeps its own window.
    expect(guard.canActivate(context(byToken, 'ip9', 'abcd'))).toBe(true);
  });

  it('evicts the oldest window once the hard cap is reached', () => {
    const guard = new RateLimitGuard(new Reflector());
    guard.maxKeys = 3;
    const perIp: RateLimitRule[] = [
      { name: 'ip', limit: 1, windowMs: 60_000, by: 'ip' },
    ];
    for (const ip of ['a', 'b', 'c', 'd']) {
      guard.canActivate(context(perIp, ip));
    }
    expect(guard.size).toBe(3);
    // "a" was evicted, so it gets a fresh window instead of a 429.
    expect(guard.canActivate(context(perIp, 'a'))).toBe(true);
  });

  it('sweeps expired windows off the request path', () => {
    const guard = new RateLimitGuard(new Reflector());
    const perIp: RateLimitRule[] = [
      { name: 'ip', limit: 5, windowMs: 1_000, by: 'ip' },
    ];
    guard.canActivate(context(perIp, 'a'));
    guard.canActivate(context(perIp, 'b'));
    guard.sweep(Date.now() + 2_000);
    expect(guard.size).toBe(0);
  });
});
