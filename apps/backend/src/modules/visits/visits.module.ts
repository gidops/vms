import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { VisitAccessService } from './access.service';
import { VisitAuthoringService } from './authoring.service';
import { VisitModerationService } from './moderation.service';
import { VisitReadService } from './read.service';
import { VisitsController } from './visits.controller';

@Module({
  imports: [PrismaModule],
  controllers: [VisitsController],
  providers: [
    VisitReadService,
    VisitAuthoringService,
    VisitModerationService,
    VisitAccessService,
  ],
  exports: [
    VisitReadService,
    VisitAuthoringService,
    VisitModerationService,
    VisitAccessService,
  ],
})
export class VisitsModule {}
