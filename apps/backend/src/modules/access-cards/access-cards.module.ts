import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccessCardsController } from './access-cards.controller';
import { AccessCardsService } from './access-cards.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccessCardsController],
  providers: [AccessCardsService],
  exports: [AccessCardsService],
})
export class AccessCardsModule {}
