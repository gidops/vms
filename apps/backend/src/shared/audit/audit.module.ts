import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditListener } from './audit.listener';
import { AuditRepository } from './audit.repository';

@Module({
  imports: [PrismaModule],
  providers: [AuditRepository, AuditListener],
  exports: [AuditRepository],
})
export class AuditModule {}
