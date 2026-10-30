import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RateLimitGuard } from '../../shared/rate-limit/rate-limit.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { GateKioskController } from './gate-kiosk.controller';
import { GateKioskService } from './gate-kiosk.service';
import { GateController } from './gate.controller';
import { GateService } from './gate.service';

/** The no-login gate kiosk (scan-and-check) and the System Admin's management of its link. */
@Module({
  // NotificationsModule provides the QR renderer for the kiosk link.
  imports: [PrismaModule, NotificationsModule],
  controllers: [GateController, GateKioskController],
  providers: [GateService, GateKioskService, RateLimitGuard],
})
export class GateModule {}
