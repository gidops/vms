import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  FlagVisitInput,
  RequestInfoInput,
  VisitRequestDetail,
} from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { isTerminal } from './helpers/visit.grouping';
import { ensureAllExist, ensureExists } from './helpers/visit.guards';
import { VisitReadService } from './read.service';

@Injectable()
export class VisitModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly read: VisitReadService,
  ) {}

  async approve(id: string, actorUserId: string): Promise<VisitRequestDetail> {
    await ensureExists(this.prisma, id);

    // No pass is minted here; the physical badge is assigned at check-in.
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
    return this.read.getDetail(id);
  }

  /** One VisitApproved event per visit so each guest still gets their own QR email. */
  async bulkApprove(
    visitIds: string[],
    actorUserId: string,
  ): Promise<VisitRequestDetail[]> {
    const ids = [...new Set(visitIds)];
    await ensureAllExist(this.prisma, ids);
    await this.txm.run(async (tx) => {
      await tx.visit.updateMany({
        where: { id: { in: ids } },
        data: { status: 'APPROVED', approvedById: actorUserId },
      });
      for (const id of ids) {
        await this.events.publish(tx, {
          type: EVENT_TYPES.VisitApproved,
          aggregateType: 'Visit',
          aggregateId: id,
          payload: { visitId: id },
          metadata: { actorUserId },
        });
      }
    });
    return Promise.all(ids.map((id) => this.read.getDetail(id)));
  }

  async deny(
    id: string,
    reason: string,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    await ensureExists(this.prisma, id);
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
    return this.read.getDetail(id);
  }

  async bulkDeny(
    visitIds: string[],
    reason: string,
    actorUserId: string,
  ): Promise<VisitRequestDetail[]> {
    const ids = [...new Set(visitIds)];
    await ensureAllExist(this.prisma, ids);
    await this.txm.run(async (tx) => {
      await tx.visit.updateMany({
        where: { id: { in: ids } },
        data: { status: 'DENIED', deniedReason: reason },
      });
      for (const id of ids) {
        await this.events.publish(tx, {
          type: EVENT_TYPES.VisitDenied,
          aggregateType: 'Visit',
          aggregateId: id,
          payload: { visitId: id, reason },
          metadata: { actorUserId },
        });
      }
    });
    return Promise.all(ids.map((id) => this.read.getDetail(id)));
  }

  /** An open SECURITY_REVIEW alert blocks check-in until the Security Manager resolves it. */
  async flag(
    id: string,
    input: FlagVisitInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: { id: true, status: true, visitorId: true },
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    if (isTerminal(visit.status)) {
      throw new BadRequestException('errors.visit.notFlaggable');
    }
    await this.txm.run(async (tx) => {
      await tx.visit.update({ where: { id }, data: { status: 'FLAGGED' } });
      const alert = await tx.alert.create({
        data: {
          visitId: id,
          visitorId: visit.visitorId,
          type: 'SECURITY_REVIEW',
          level: input.level,
          status: 'OPEN',
          reason: input.reason,
          category: input.category ?? null,
          raisedById: actorUserId,
        },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitFlagged,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id, alertId: alert.id, level: input.level },
        metadata: { actorUserId },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.AlertCreated,
        aggregateType: 'Alert',
        aggregateId: alert.id,
        payload: { alertId: alert.id, visitId: id, type: 'SECURITY_REVIEW' },
        metadata: { actorUserId },
      });
    });
    return this.read.getDetail(id);
  }

  async requestInfo(
    id: string,
    input: RequestInfoInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: { id: true, status: true, visitorId: true },
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    if (isTerminal(visit.status)) {
      throw new BadRequestException('errors.visit.notReviewable');
    }
    await this.txm.run(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: { status: 'REVIEW_REQUESTED' },
      });
      const alert = await tx.alert.create({
        data: {
          visitId: id,
          visitorId: visit.visitorId,
          type: 'ADDITIONAL_INFO',
          level: 'MEDIUM',
          status: 'OPEN',
          reason: input.reason,
          raisedById: actorUserId,
        },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitReviewRequested,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id, alertId: alert.id },
        metadata: { actorUserId },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.AlertCreated,
        aggregateType: 'Alert',
        aggregateId: alert.id,
        payload: { alertId: alert.id, visitId: id, type: 'ADDITIONAL_INFO' },
        metadata: { actorUserId },
      });
    });
    return this.read.getDetail(id);
  }
}
