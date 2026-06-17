import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CLS_IP, CLS_USER_AGENT } from '../logging/cls-keys';
import { AuditRepository } from './audit.repository';
import { SeqService } from './seq.service';

export interface SecurityEvent {
  /** Canonical event name from EVENT_TYPES (e.g. 'auth.login_failed'). */
  action: string;
  /** Aggregate the event concerns — 'User', 'Session', 'Authorization', … */
  entityType: string;
  entityId?: string;
  actorUserId?: string;
  /** Warnings/errors (failed login, reuse, denial) raise the Seq level. */
  level?: 'Information' | 'Warning' | 'Error';
  metadata?: Record<string, unknown>;
}

/**
 * Records security-relevant events that have NO successful business transaction
 * to ride the transactional outbox — failed logins, logout, token refresh/reuse,
 * role switches, permission denials. Writes directly to `AuditLog` (source of
 * truth) and mirrors to Seq. Request context (correlationId/ip/userAgent) is
 * pulled from the CLS so callers don't have to thread it through.
 *
 * Best-effort: a failure here must never mask the original auth/authz outcome,
 * so write errors are logged and swallowed.
 */
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
