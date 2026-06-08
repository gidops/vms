import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './shared/config/env.schema';
import { AllExceptionsFilter } from './shared/common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route Nest's logs through pino (structured + correlation ids).
  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.enableCors();
  app.enableShutdownHooks();

  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);
}

void bootstrap();
