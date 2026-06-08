import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsModule, ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import type { Env } from '../config/env.schema';

const CORRELATION_HEADER = 'x-correlation-id';

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
