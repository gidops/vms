import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { VisitsModule } from '../visits/visits.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

@Module({
  imports: [PrismaModule, VisitsModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
