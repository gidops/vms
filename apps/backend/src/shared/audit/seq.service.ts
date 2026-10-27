import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

export interface SeqAuditEvent {
  action: string;
  entityType: string;
  entityId?: string;
  eventType?: string;
  actorUserId?: string;
  correlationId?: string;
  ip?: string;
  userAgent?: string;
  level?: 'Information' | 'Warning' | 'Error';
  metadata?: unknown;
}

/** Fire-and-forget: a Seq outage must never break the audit write or the request. */
@Injectable()
export class SeqService {
  private readonly logger = new Logger(SeqService.name);
  private readonly endpoint?: string;
  private readonly apiKey?: string;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('SEQ_URL', { infer: true });
    this.apiKey = config.get('SEQ_API_KEY', { infer: true });
    this.endpoint = url
      ? `${url.replace(/\/$/, '')}/api/events/raw?clef`
      : undefined;
  }

  get enabled(): boolean {
    return Boolean(this.endpoint);
  }

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
