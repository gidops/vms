import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CLS_IP, CLS_USER_AGENT } from '../logging/cls-keys';
import { AuditRepository } from './audit.repository';
import { SeqService } from './seq.service';

export interface SecurityEvent {
  action: string;
  entityType: string;
  entityId?: string;
  actorUserId?: string;
  level?: 'Information' | 'Warning' | 'Error';
  metadata?: Record<string, unknown>;
}

/** For security events with no business transaction; errors are swallowed so they never mask the auth outcome. */
@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(
    private readonly audit: AuditRepository,
    private readonly seq: SeqService,
    private readonly cls: ClsService,
  ) {}

  async record(event: SecurityEvent): Promise<void> {
    const correlationId = this.cls.getId();
    const ip = this.cls.get<string | undefined>(CLS_IP);
    const userAgent = this.cls.get<string | undefined>(CLS_USER_AGENT);

    try {
      await this.audit.record({
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        eventType: event.action,
        actorUserId: event.actorUserId,
        correlationId,
        ip,
        userAgent,
        metadata: event.metadata,
      });
    } catch (err) {
      this.logger.error(
        `Failed to write security audit log for ${event.action}`,
        err as Error,
      );
      return;
    }

    this.seq.emit({
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      eventType: event.action,
      actorUserId: event.actorUserId,
      correlationId,
      ip,
      userAgent,
      level: event.level ?? 'Warning',
      metadata: event.metadata,
    });
  }
}
