import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditTrailController } from './audit-trail.controller';
import { AuditTrailService } from './audit-trail.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuditTrailController],
  providers: [AuditTrailService],
})
export class AuditTrailModule {}
