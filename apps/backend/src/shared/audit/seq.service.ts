import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

/** Structured fields mirrored to Seq for one audit event. */
export interface SeqAuditEvent {
  action: string;
  entityType: string;
  entityId?: string;
  eventType?: string;
  actorUserId?: string;
  correlationId?: string;
  ip?: string;
  userAgent?: string;
  /** Higher level (e.g. 'Warning') for security-relevant failures. */
  level?: 'Information' | 'Warning' | 'Error';
  metadata?: unknown;
}

/**
 * Mirrors audit events to Seq (https://datalust.co/seq) in CLEF format. Seq is a
 * searchable, queryable view of the audit trail; PostgreSQL (`AuditLog`) remains
 * the system of record. Shipping is best-effort and fire-and-forget — a Seq
 * outage must never break the audit write or the request path. A no-op when
 * SEQ_URL is unset (CI / bare local dev).
 */
@Injectable()
export class SeqService {
  private readonly logger = new Logger(SeqService.name);
  private readonly endpoint?: string;
  private readonly apiKey?: string;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('SEQ_URL', { infer: true });
    this.apiKey = config.get('SEQ_API_KEY', { infer: true });
    // Seq's raw CLEF ingestion endpoint.
    this.endpoint = url
      ? `${url.replace(/\/$/, '')}/api/events/raw?clef`
      : undefined;
  }

  get enabled(): boolean {
    return Boolean(this.endpoint);
  }

  /**
   * Send one audit event to Seq. Resolves immediately; the network call runs in
   * the background and any failure is logged at debug (never thrown).
   */
  emit(event: SeqAuditEvent): void {
    if (!this.endpoint) return;
    const clef = {
      '@t': new Date().toISOString(),
      '@mt': 'Audit {action} {entityType} {entityId}',
      '@l': event.level ?? 'Information',
      audit: true,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      eventType: event.eventType ?? event.action,
      actorUserId: event.actorUserId,
      correlationId: event.correlationId,
      ip: event.ip,
      userAgent: event.userAgent,
      metadata: event.metadata,
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.serilog.clef',
    };
    if (this.apiKey) headers['X-Seq-ApiKey'] = this.apiKey;

    void fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(clef),
    }).catch((err: unknown) => {
      this.logger.debug(
        `Failed to mirror audit event to Seq: ${(err as Error).message}`,
      );
    });
  }
}
