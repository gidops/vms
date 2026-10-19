import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

/** One limit: at most `limit` requests per `windowMs` for each key. */
export interface RateLimitRule {
  /** Short name so different rules on one route count separately. */
  name: string;
  limit: number;
  windowMs: number;
  /**
   * What to count by: the caller's IP, or a route param (e.g. the desk QR
   * token, so one leaked link can't be hammered from many addresses).
   */
  by: 'ip' | { param: string };
}

export const RATE_LIMIT_KEY = 'rateLimitRules';

/** Apply one or more fixed-window limits to a route (use with RateLimitGuard). */
export const RateLimit = (...rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_KEY, rules);

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window rate limiter for the public (no login) routes. Counts live in
 * this process's memory, which is enough for the single demo instance; a
 * multi-instance deployment needs a shared store (e.g. Redis) instead. Behind a
 * proxy, `req.ip` is the proxy's address unless Express `trust proxy` is set,
 * so the per-token rules are the backstop there.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[] | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rules?.length) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    this.sweep(now);
    for (const rule of rules) {
      const subject =
        rule.by === 'ip'
          ? (req.ip ?? 'unknown')
          : String(req.params?.[rule.by.param] ?? '');
      const key = `${rule.name}:${subject}`;
      const current = this.windows.get(key);
      const window =
        current && current.resetAt > now
          ? current
          : { count: 0, resetAt: now + rule.windowMs };
      window.count += 1;
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

  /** Drop expired windows now and then so the map can't grow without bound. */
  private sweep(now: number): void {
    if (this.windows.size < 5_000) return;
    for (const [key, w] of this.windows) {
      if (w.resetAt <= now) this.windows.delete(key);
    }
  }
}
