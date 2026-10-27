import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VisitAccessService } from './access.service';
import { VisitDashboardService } from './dashboard.service';
import { VisitAuthoringService } from './authoring.service';
import { VisitDeliveriesService } from './deliveries.service';
import { VisitEvacuationService } from './evacuation.service';
import { VisitExportService } from './export.service';
import { VisitModerationService } from './moderation.service';
import { VisitReadService } from './read.service';
import { VisitsController } from './visits.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [VisitsController],
  providers: [
    VisitDashboardService,
    VisitReadService,
    VisitAuthoringService,
    VisitModerationService,
    VisitAccessService,
    VisitEvacuationService,
    VisitExportService,
    VisitDeliveriesService,
  ],
  exports: [
    VisitDashboardService,
    VisitReadService,
    VisitAuthoringService,
    VisitModerationService,
    VisitAccessService,
  ],
})
export class VisitsModule {}
