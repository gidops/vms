import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export interface RateLimitRule {
  name: string;
  limit: number;
  windowMs: number;
  /**
   * A param key (e.g. the desk QR token) stops one leaked link being hammered
   * from many IPs. Values failing `pattern` share one bucket, so random tokens
   * can't each create an entry.
   */
  by: 'ip' | { param: string; pattern?: RegExp };
}

export const RATE_LIMIT_KEY = 'rateLimitRules';

export const RateLimit = (...rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_KEY, rules);

interface Window {
  count: number;
  resetAt: number;
}

const SWEEP_INTERVAL_MS = 60_000;

/**
 * In-memory counts, so limits are per process: running more than one backend
 * instance needs a shared store (e.g. Redis) instead.
 */
@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly windows = new Map<string, Window>();
  /** Hard cap; the oldest windows are evicted first once it is reached. */
  maxKeys = 50_000;
  private readonly sweeper: NodeJS.Timeout;

  constructor(private readonly reflector: Reflector) {
    this.sweeper = setInterval(() => this.sweep(Date.now()), SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  canActivate(context: ExecutionContext): boolean {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[] | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rules?.length) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    for (const rule of rules) {
      const key = `${rule.name}:${subjectOf(rule, req)}`;
      const current = this.windows.get(key);
      const window =
        current && current.resetAt > now
          ? current
          : { count: 0, resetAt: now + rule.windowMs };
      window.count += 1;
      if (!current) this.evictIfFull();
      this.windows.set(key, window);
      if (window.count > rule.limit) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'errors.rateLimited',
            retryAfterSeconds: Math.ceil((window.resetAt - now) / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return true;
  }

  /** Drops expired windows; runs on a timer, never on the request path. */
  sweep(now: number): void {
    for (const [key, w] of this.windows) {
      if (w.resetAt <= now) this.windows.delete(key);
    }
  }

  get size(): number {
    return this.windows.size;
  }

  private evictIfFull(): void {
    if (this.windows.size < this.maxKeys) return;
    // Maps iterate in insertion order, so the first key is the oldest window.
    for (const oldest of this.windows.keys()) {
      this.windows.delete(oldest);
      return;
    }
  }
}

function subjectOf(rule: RateLimitRule, req: Request): string {
  if (rule.by === 'ip') return req.ip ?? 'unknown';
  const value = String(req.params?.[rule.by.param] ?? '');
  return rule.by.pattern && !rule.by.pattern.test(value) ? '<invalid>' : value;
}
