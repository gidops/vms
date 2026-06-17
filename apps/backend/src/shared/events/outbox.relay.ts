import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Env } from '../config/env.schema';
import type { DomainEvent, EventMetadata } from './domain-event';
import { OutboxRepository } from './outbox.repository';

const BATCH_SIZE = 50;
const RETRY_BACKOFF_MS = 5000;

/**
 * Polls the outbox and republishes PENDING events onto the in-process bus
 * (EventEmitter2). This is the ONLY component that knows the transport; moving
 * to NATS later is a change here alone. Runs as a simple interval loop so we
 * don't add a scheduler dependency.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private draining = false;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    const interval = this.config.get('OUTBOX_POLL_INTERVAL_MS', {
      infer: true,
    });
    this.timer = setInterval(() => void this.drain(), interval);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const rows = await this.outbox.fetchPending(BATCH_SIZE);
      for (const row of rows) {
        const event: DomainEvent = {
          id: row.id,
          type: row.eventType,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          payload: row.payload,
          metadata: (row.metadata ?? {}) as EventMetadata,
          occurredAt: row.createdAt.toISOString(),
        };
        try {
          await this.emitter.emitAsync(event.type, event);
          await this.outbox.markPublished(row.id);
        } catch (err) {
          this.logger.error(
            `Failed to publish outbox event ${row.id} (${row.eventType})`,
            err as Error,
          );
          await this.outbox.markFailed(row.id, RETRY_BACKOFF_MS);
        }
      }
    } catch (err) {
      this.logger.error('Outbox drain failed', err as Error);
    } finally {
      this.draining = false;
    }
  }
}
