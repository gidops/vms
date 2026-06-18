import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './shared/config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route Nest's logs through pino (structured + correlation ids).
  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.enableCors();
  app.enableShutdownHooks();

  // AllExceptionsFilter is registered as a global APP_FILTER provider in
  // AppModule so it can inject I18nService for localized error responses.

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);
}

void bootstrap();
