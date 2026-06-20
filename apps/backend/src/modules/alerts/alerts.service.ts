import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AlertWithVisitor, UpdateAlertStatusInput } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';

const detailInclude = Prisma.validator<Prisma.AlertInclude>()({
  visitor: true,
  notes: { include: { author: true }, orderBy: { createdAt: 'asc' } },
});

type AlertDetailRow = Prisma.AlertGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  async getDetail(id: string): Promise<AlertWithVisitor> {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!alert) throw new NotFoundException('Alert not found');
    return this.toDetail(alert);
  }

  async updateStatus(
    id: string,
    input: UpdateAlertStatusInput,
    actorUserId: string,
  ): Promise<AlertWithVisitor> {
    const count = await this.prisma.alert.count({ where: { id } });
    if (count === 0) throw new NotFoundException('Alert not found');

    await this.txm.run(async (tx) => {
      await tx.alert.update({
        where: { id },
        data: {
          status: input.status,
          resolvedById:
            input.status === 'RESOLVED' || input.status === 'DISMISSED'
              ? actorUserId
              : null,
        },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.AlertUpdated,
        aggregateType: 'Alert',
        aggregateId: id,
        payload: { alertId: id, status: input.status },
        metadata: { actorUserId },
      });
    });
    return this.getDetail(id);
  }

  private toDetail(alert: AlertDetailRow): AlertWithVisitor {
    return {
      id: alert.id,
      visitId: alert.visitId,
      visitorId: alert.visitorId,
      level: alert.level,
      status: alert.status,
      reason: alert.reason,
      category: alert.category,
      raisedById: alert.raisedById,
      resolvedById: alert.resolvedById,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
      visitor: alert.visitor,
      notes: alert.notes.map((note) => ({
        id: note.id,
        visitId: note.visitId,
        alertId: note.alertId,
        authorId: note.authorId,
        authorName: note.authorName,
        body: note.body,
        createdAt: note.createdAt,
      })),
    };
  }
}
