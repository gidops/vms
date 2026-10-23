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
