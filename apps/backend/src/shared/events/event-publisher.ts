import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import type { DomainEvent, EventMetadata } from './domain-event';
import { OutboxRepository } from './outbox.repository';

export interface PublishParams {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  metadata?: EventMetadata;
}

/**
 * Builds a domain event (stamping correlation id from the request CLS) and
 * appends it to the outbox within the caller's transaction. Swapping the
 * downstream transport to NATS later changes only the relay, never callers.
 */
@Injectable()
export class EventPublisher {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly cls: ClsService,
  ) {}

  async publish(
    tx: Prisma.TransactionClient,
    params: PublishParams,
  ): Promise<DomainEvent> {
    const event: DomainEvent = {
      id: randomUUID(),
      type: params.type,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      payload: params.payload,
      metadata: {
        correlationId: this.cls.getId(),
        ...params.metadata,
      },
      occurredAt: new Date().toISOString(),
    };
    await this.outbox.append(tx, event);
    return event;
  }
}
