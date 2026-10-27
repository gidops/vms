import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './shared/config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  app.use(helmet());
  // Expose Content-Disposition so the browser can read export filenames.
  app.enableCors({ exposedHeaders: ['Content-Disposition'] });
  app.enableShutdownHooks();

  // AllExceptionsFilter is an APP_FILTER provider in AppModule so it can inject I18nService.

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  // Trust only TRUST_PROXY_HOPS hops of X-Forwarded-For, so rate limits and audit IPs see the visitor and can't be spoofed.
  const proxyHops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (proxyHops > 0) app.set('trust proxy', proxyHops);

  await app.listen(port);
}

void bootstrap();
