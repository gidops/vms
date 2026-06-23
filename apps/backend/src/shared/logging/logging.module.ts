import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsModule, ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import type { Env } from '../config/env.schema';
import { normalizeLocale } from '../i18n/i18n.service';
import { CLS_IP, CLS_LOCALE, CLS_USER_AGENT } from './cls-keys';

const CORRELATION_HEADER = 'x-correlation-id';

/** First value of a possibly-repeated header. */
function headerValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Resolve the request locale from the explicit header, then Accept-Language. */
function requestLocale(req: IncomingMessage): string {
  const explicit = headerValue(req.headers['x-locale']);
  if (explicit) return normalizeLocale(explicit);
  const accept = headerValue(req.headers['accept-language']);
  return normalizeLocale(accept?.split(',')[0]);
}

/** Best-effort client IP from proxy headers, falling back to the socket. */
function clientIp(req: IncomingMessage & { ip?: string }): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return first?.split(',')[0]?.trim() ?? req.ip ?? req.socket?.remoteAddress;
}

/**
 * Structured logging (pino) + request-scoped correlation IDs (nestjs-cls).
 *
 * - Every request is wrapped in an AsyncLocalStorage context whose id is taken
 *   from the inbound `x-correlation-id` header (or generated). App code reads it
 *   via ClsService; the pino `mixin` stamps it onto every log line, so a single
 *   id ties together all logs (and later, audit rows + domain events).
 * - Sensitive fields are redacted. Pretty output in dev, JSON in prod
 *   (JSON is what a SEQ/Loki/CloudWatch sink ingests).
 */
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: IncomingMessage) => {
          const header = req.headers[CORRELATION_HEADER];
          const fromHeader = Array.isArray(header) ? header[0] : header;
          return fromHeader ?? randomUUID();
        },
        // Capture request origin so domain events (and their audit rows) record
        // "who, from where" without threading it through every call site.
        setup: (cls, req: IncomingMessage & { ip?: string }) => {
          cls.set(CLS_IP, clientIp(req));
          cls.set(CLS_USER_AGENT, req.headers['user-agent']);
          cls.set(CLS_LOCALE, requestLocale(req));
        },
      },
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService, ClsService],
      useFactory: (config: ConfigService<Env, true>, cls: ClsService) => {
        const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            transport: isProd
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
            mixin() {
              const correlationId = cls.getId();
              return correlationId ? { correlationId } : {};
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'password',
                '*.password',
                'passwordHash',
                '*.passwordHash',
                'tokenHash',
                '*.tokenHash',
              ],
              remove: true,
            },
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
