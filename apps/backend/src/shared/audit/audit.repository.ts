import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  eventType?: string;
  actorUserId?: string;
  correlationId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: unknown;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        eventType: entry.eventType,
        actorUserId: entry.actorUserId,
        correlationId: entry.correlationId,
        ip: entry.ip,
        userAgent: entry.userAgent,
        metadata: entry.metadata ?? undefined,
      },
    });
  }
}
