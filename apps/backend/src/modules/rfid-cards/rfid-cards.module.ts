import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RfidCardsController } from './rfid-cards.controller';
import { RfidCardsService } from './rfid-cards.service';

@Module({
  imports: [PrismaModule],
  controllers: [RfidCardsController],
  providers: [RfidCardsService],
})
export class RfidCardsModule {}
