import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RateLimitGuard } from '../../shared/rate-limit/rate-limit.guard';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VisitsModule } from '../visits/visits.module';
import { DeskQrController } from './desk-qr.controller';
import { DeskQrService } from './desk-qr.service';
import { PublicRegistrationController } from './public-registration.controller';
import { PublicRegistrationService } from './public-registration.service';

/** The VMC desk QR and the visitor self-registration it opens. */
@Module({
  imports: [PrismaModule, IdentityModule, NotificationsModule, VisitsModule],
  controllers: [DeskQrController, PublicRegistrationController],
  providers: [DeskQrService, PublicRegistrationService, RateLimitGuard],
  exports: [DeskQrService],
})
export class DeskQrModule {}
