import { Injectable } from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { DomainEvent } from './domain-event';

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Append an event row inside the SAME transaction as the state change. */
  async append(
    tx: Prisma.TransactionClient,
    event: DomainEvent,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        id: event.id,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.type,
        payload: event.payload as Prisma.InputJsonValue,
        metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  fetchPending(limit: number) {
    return this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING, availableAt: { lte: new Date() } },
      orderBy: { availableAt: 'asc' },
      take: limit,
    });
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
    });
  }

  async markFailed(id: string, backoffMs: number): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        availableAt: new Date(Date.now() + backoffMs),
      },
    });
  }
}
