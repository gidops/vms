import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccessCardsController } from './access-cards.controller';
import { AccessCardsService } from './access-cards.service';
import { VisitorPassesController } from './visitor-passes.controller';
import { VisitorPassesService } from './visitor-passes.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccessCardsController, VisitorPassesController],
  providers: [AccessCardsService, VisitorPassesService],
  exports: [AccessCardsService],
})
export class AccessCardsModule {}
