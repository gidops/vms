import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEvent } from '../events/domain-event';
import { AuditRepository } from './audit.repository';
import { SeqService } from './seq.service';

function isDomainEvent(value: unknown): value is DomainEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'aggregateType' in value
  );
}

/**
 * Writes an append-only audit row for EVERY domain event relayed onto the bus.
 * Single source of truth for the audit trail — business code never calls the
 * audit log directly.
 */
@Injectable()
export class AuditListener {
  private readonly logger = new Logger(AuditListener.name);

  constructor(
    private readonly audit: AuditRepository,
    private readonly seq: SeqService,
  ) {}

  @OnEvent('**')
  async handleAll(event: unknown): Promise<void> {
    if (!isDomainEvent(event)) return;
    const meta = event.metadata;
    try {
      await this.audit.record({
        action: event.type,
        entityType: event.aggregateType,
        entityId: event.aggregateId,
        eventType: event.type,
        actorUserId: meta?.actorUserId,
        correlationId: meta?.correlationId,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        metadata: event.payload,
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for event ${event.type}`,
        err as Error,
      );
      // PostgreSQL is the source of truth: if the row failed, don't mirror to Seq.
      return;
    }
    // Mirror to Seq for searchable trails (best-effort, never throws).
    this.seq.emit({
      action: event.type,
      entityType: event.aggregateType,
      entityId: event.aggregateId,
      eventType: event.type,
      actorUserId: meta?.actorUserId,
      correlationId: meta?.correlationId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: event.payload,
    });
  }
}
