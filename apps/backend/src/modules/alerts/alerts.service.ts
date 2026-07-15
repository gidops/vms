import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AlertWithVisitor, UpdateAlertStatusInput } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';

const detailInclude = Prisma.validator<Prisma.AlertInclude>()({
  visitor: true,
  visit: { include: { host: { include: { user: true } } } },
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
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      select: { id: true, visitId: true, type: true },
    });
    if (!alert) throw new NotFoundException('Alert not found');
    const closing = input.status === 'RESOLVED' || input.status === 'DISMISSED';

    await this.txm.run(async (tx) => {
      await tx.alert.update({
        where: { id },
        data: {
          status: input.status,
          resolvedById: closing ? actorUserId : null,
        },
      });
      // Closing the alert that held the visit clears its hold so VMC can proceed:
      // a resolved flag returns the visit to APPROVED (check-in allowed); a resolved
      // more-info request returns it to PENDING (back in the Security Manager decision queue).
      // Only clears once no other open alert of the matching kind remains.
      if (closing && alert.visitId) {
        await this.clearVisitHold(tx, alert.visitId);
      }
      await this.events.publish(tx, {
        type: EVENT_TYPES.AlertUpdated,
        aggregateType: 'Alert',
        aggregateId: id,
        payload: { alertId: id, status: input.status, visitId: alert.visitId },
        metadata: { actorUserId },
      });
    });
    return this.getDetail(id);
  }

  /**
   * After a security alert is resolved/dismissed, lift the visit's hold if no other
   * open alert of the same kind remains: FLAGGED (security review / restricted match)
   * → APPROVED; REVIEW_REQUESTED (additional info) → PENDING.
   */
  private async clearVisitHold(
    tx: Prisma.TransactionClient,
    visitId: string,
  ): Promise<void> {
    const visit = await tx.visit.findUnique({
      where: { id: visitId },
      select: { status: true },
    });
    if (!visit) return;

    if (visit.status === 'FLAGGED') {
      const remaining = await tx.alert.count({
        where: {
          visitId,
          status: 'OPEN',
          type: { in: ['SECURITY_REVIEW', 'RESTRICTED_MATCH'] },
        },
      });
      if (remaining === 0) {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: 'APPROVED' },
        });
      }
    } else if (visit.status === 'REVIEW_REQUESTED') {
      const remaining = await tx.alert.count({
        where: { visitId, status: 'OPEN', type: 'ADDITIONAL_INFO' },
      });
      if (remaining === 0) {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: 'PENDING' },
        });
      }
    }
  }

  private toDetail(alert: AlertDetailRow): AlertWithVisitor {
    return {
      id: alert.id,
      visitId: alert.visitId,
      visitorId: alert.visitorId,
      type: alert.type,
      level: alert.level,
      status: alert.status,
      reason: alert.reason,
      category: alert.category,
      raisedById: alert.raisedById,
      resolvedById: alert.resolvedById,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
      visitor: alert.visitor,
      visit: alert.visit
        ? {
            hostName: alert.visit.host?.user.fullName ?? null,
            hostUnit: alert.visit.host?.department ?? null,
            floor: alert.visit.floor,
            scheduledAt: alert.visit.scheduledAt,
          }
        : null,
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
