import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

@Module({
  imports: [PrismaModule],
  controllers: [InboxController],
  providers: [InboxService],
})
export class InboxModule {}
