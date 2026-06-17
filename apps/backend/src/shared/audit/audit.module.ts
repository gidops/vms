import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditListener } from './audit.listener';
import { AuditRepository } from './audit.repository';
import { SecurityAuditService } from './security-audit.service';
import { SeqService } from './seq.service';

@Module({
  imports: [PrismaModule],
  providers: [AuditRepository, AuditListener, SeqService, SecurityAuditService],
  exports: [AuditRepository, SecurityAuditService],
})
export class AuditModule {}
