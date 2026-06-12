import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  UpdateVisitRequestInput,
  VisitRequestDetail,
} from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';

const detailInclude = Prisma.validator<Prisma.VisitInclude>()({
  visitor: true,
  host: { include: { user: true } },
  createdBy: true,
  notes: { include: { author: true }, orderBy: { createdAt: 'asc' } },
});

type VisitDetailRow = Prisma.VisitGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  async getDetail(id: string): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!visit) throw new NotFoundException('Visit not found');
    return this.toDetail(visit);
  }

  async cancel(id: string, actorUserId: string): Promise<VisitRequestDetail> {
    await this.ensureExists(id);
    await this.txm.run(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitCancelled,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id },
        metadata: { actorUserId },
      });
    });
    return this.getDetail(id);
  }

  async update(
    id: string,
    input: UpdateVisitRequestInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    await this.ensureExists(id);
    await this.txm.run(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: { purpose: input.purpose, scheduledAt: input.scheduledAt },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitUpdated,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id, ...input },
        metadata: { actorUserId },
      });
    });
    return this.getDetail(id);
  }

  async approve(id: string, actorUserId: string): Promise<VisitRequestDetail> {
    await this.ensureExists(id);
    await this.txm.run(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: actorUserId },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitApproved,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id },
        metadata: { actorUserId },
      });
    });
    return this.getDetail(id);
  }

  async deny(
    id: string,
    reason: string,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    await this.ensureExists(id);
    await this.txm.run(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: { status: 'DENIED', deniedReason: reason },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitDenied,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id, reason },
        metadata: { actorUserId },
      });
    });
    return this.getDetail(id);
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.visit.count({ where: { id } });
    if (count === 0) throw new NotFoundException('Visit not found');
  }

  private toDetail(visit: VisitDetailRow): VisitRequestDetail {
    return {
      id: visit.id,
      visitorId: visit.visitorId,
      hostId: visit.hostId,
      invitationId: visit.invitationId,
      type: visit.type,
      status: visit.status,
      purpose: visit.purpose,
      riskLevel: visit.riskLevel,
      scheduledAt: visit.scheduledAt,
      checkInAt: visit.checkInAt,
      checkOutAt: visit.checkOutAt,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
      source: visit.source,
      createdById: visit.createdById,
      createdByName: visit.createdBy?.fullName ?? null,
      visitor: visit.visitor,
      host: {
        id: visit.host.id,
        userId: visit.host.userId,
        department: visit.host.department,
        office: visit.host.office,
        createdAt: visit.host.createdAt,
        updatedAt: visit.host.updatedAt,
        user: {
          id: visit.host.user.id,
          fullName: visit.host.user.fullName,
          email: visit.host.user.email,
        },
      },
      notes: visit.notes.map((note) => ({
        id: note.id,
        visitId: note.visitId,
        alertId: note.alertId,
        authorId: note.authorId,
        authorName: note.author.fullName,
        body: note.body,
        createdAt: note.createdAt,
      })),
    };
  }
}
