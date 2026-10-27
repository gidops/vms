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

export interface RateLimitRule {
  name: string;
  limit: number;
  windowMs: number;
  /** A param key (e.g. the desk QR token) stops one leaked link being hammered from many IPs. */
  by: 'ip' | { param: string };
}

export const RATE_LIMIT_KEY = 'rateLimitRules';

export const RateLimit = (...rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_KEY, rules);

interface Window {
  count: number;
  resetAt: number;
}

/** In-memory counts: a multi-instance deployment needs a shared store. */
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

  /** Keeps the map from growing without bound. */
  private sweep(now: number): void {
    if (this.windows.size < 5_000) return;
    for (const [key, w] of this.windows) {
      if (w.resetAt <= now) this.windows.delete(key);
    }
  }
}
