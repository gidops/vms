import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { CLS_IP, CLS_LOCALE, CLS_USER_AGENT } from '../logging/cls-keys';
import type { DomainEvent, EventMetadata } from './domain-event';
import { OutboxRepository } from './outbox.repository';

export interface PublishParams {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  metadata?: EventMetadata;
}

/** Appends to the outbox within the caller's transaction; never publishes to the bus directly. */
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
        ip: this.cls.get<string | undefined>(CLS_IP),
        userAgent: this.cls.get<string | undefined>(CLS_USER_AGENT),
        locale: this.cls.get<string | undefined>(CLS_LOCALE),
        ...params.metadata,
      },
      occurredAt: new Date().toISOString(),
    };
    await this.outbox.append(tx, event);
    return event;
  }
}
