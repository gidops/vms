import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';

/**
 * Loads + validates environment variables once, globally. Reads `.env` (cwd)
 * for local dev; in containers the variables are already present in the
 * environment. `validateEnv` enforces the schema at startup.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
