import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IdentityModule } from './modules/identity/identity.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './shared/audit/audit.module';
import { AuthModule } from './shared/auth/auth.module';
import { ConfigModule } from './shared/config/config.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { EventsModule } from './shared/events/events.module';
import { LoggingModule } from './shared/logging/logging.module';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    CryptoModule,
    EventsModule,
    AuditModule,
    IdentityModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
