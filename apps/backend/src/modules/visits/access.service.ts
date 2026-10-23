import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CheckInVisitInput,
  CheckOutVisitInput,
  RateVisitInput,
  VisitRequestDetail,
} from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { PASS_TTL_MS, generateAccessCode } from './helpers/visit.codes';
import { ensureExists } from './helpers/visit.guards';
import { VisitReadService } from './read.service';

/**
 * On-site side of the visits module — the VMC desk operations: check-in
 * (assign a badge, mark on-site), check-out (release the badge, mark off-site),
 * and the host's post-visit rating.
 */
@Injectable()
export class VisitAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly read: VisitReadService,
  ) {}

  /**
   * VMC check-in: assign a physical badge (AccessCard) to an approved visit, mark
   * it on-site, and log the gate event. The chosen badge must be in service and
   * not already assigned. Gate validation is recorded here for now (until the gate
   * scan flow ships) so the visit shows as gate-validated once on-site.
   */
  async checkIn(
    id: string,
    input: CheckInVisitInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        gateValidatedAt: true,
      },
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    if (visit.status !== 'APPROVED') {
      throw new BadRequestException('errors.visit.notCheckInable');
    }

    // Security hold: an open flag / restricted-match alert blocks check-in until the
    // the Security Manager resolves it (a FLAGGED visit is already blocked by the status check above,
    // but a system RESTRICTED_MATCH may sit on an otherwise-approved visit).
    const openSecurityAlert = await this.prisma.alert.findFirst({
      where: {
        visitId: id,
        status: 'OPEN',
        type: { in: ['SECURITY_REVIEW', 'RESTRICTED_MATCH'] },
      },
      select: { id: true },
    });
    if (openSecurityAlert) {
      throw new BadRequestException('errors.visit.securityHold');
    }

    const card = await this.prisma.accessCard.findUnique({
      where: { id: input.accessCardId },
      select: { id: true, isActive: true, passId: true },
    });
    if (!card || !card.isActive || card.passId) {
      throw new BadRequestException('errors.accessCard.unavailable');
    }

    const now = new Date();
    const expiresAt = new Date(
      (visit.scheduledAt ?? now).getTime() + PASS_TTL_MS,
    );

    await this.txm.run(async (tx) => {
      const pass = await tx.pass.upsert({
        where: { visitId: id },
        create: {
          visitId: id,
          code: generateAccessCode(),
          status: 'ACTIVE',
          expiresAt,
        },
        update: { status: 'ACTIVE', returnedAt: null, expiresAt },
      });
      // Link the chosen badge to this pass, releasing any badge it held before.
      await tx.accessCard.updateMany({
        where: { passId: pass.id },
        data: { passId: null },
      });
      await tx.accessCard.update({
        where: { id: card.id },
        data: { passId: pass.id, assignedAt: now, returnedAt: null },
      });
      await tx.visit.update({
        where: { id },
        data: {
          status: 'CHECKED_IN',
          checkInAt: now,
          gateValidatedAt: visit.gateValidatedAt ?? now,
        },
      });
      await tx.gateEvent.create({
        data: {
          visitId: id,
          gateId: 'MAIN',
          type: 'ACCESS_GRANTED',
          operativeUserId: actorUserId,
          result: 'CHECKED_IN',
        },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitorCheckedIn,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id },
        metadata: { actorUserId },
      });
    });
    return this.read.getDetail(id);
  }

  /**
   * VMC check-out: mark the visitor off-site, return the pass, and release the
   * badge back to the pool. `accessCardId` lets the operator correct the recorded
   * badge ("Change Pass ID") before releasing.
   */
  async checkOut(
    id: string,
    input: CheckOutVisitInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    await ensureExists(this.prisma, id);
    const now = new Date();
    await this.txm.run(async (tx) => {
      const pass = await tx.pass.findUnique({
        where: { visitId: id },
        include: { accessCard: true },
      });
      if (pass) {
        // "Change Pass ID": move the link to the corrected badge first.
        if (input.accessCardId && pass.accessCard?.id !== input.accessCardId) {
          await tx.accessCard.updateMany({
            where: { passId: pass.id },
            data: { passId: null },
          });
          await tx.accessCard.update({
            where: { id: input.accessCardId },
            data: {
              passId: pass.id,
              assignedAt: pass.accessCard?.assignedAt ?? now,
            },
          });
        }
        await tx.pass.update({
          where: { id: pass.id },
          data: { status: 'RETURNED', returnedAt: now },
        });
        await tx.accessCard.updateMany({
          where: { passId: pass.id },
          data: { passId: null, returnedAt: now },
        });
      }
      await tx.visit.update({
        where: { id },
        data: { status: 'CHECKED_OUT', checkOutAt: now },
      });
      await tx.gateEvent.create({
        data: {
          visitId: id,
          gateId: 'MAIN',
          type: 'ACCESS_GRANTED',
          operativeUserId: actorUserId,
          result: 'CHECKED_OUT',
        },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitorCheckedOut,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id },
        metadata: { actorUserId },
      });
    });
    return this.read.getDetail(id);
  }

  /**
   * Host rates a completed visit (1-5 stars). Only the visit's host or creator
   * may rate, and only once the visitor has checked out. Idempotent per visit.
   */
  async rate(
    id: string,
    input: RateVisitInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: {
        status: true,
        visitorId: true,
        createdById: true,
        host: { select: { userId: true } },
      },
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    if (
      visit.host?.userId !== actorUserId &&
      visit.createdById !== actorUserId
    ) {
      throw new ForbiddenException('errors.visit.notOwner');
    }
    if (visit.status !== 'CHECKED_OUT') {
      throw new BadRequestException('errors.visit.notCheckedOut');
    }
    await this.txm.run(async (tx) => {
      await tx.rating.upsert({
        where: { visitId: id },
        create: {
          visitId: id,
          visitorId: visit.visitorId,
          score: input.score,
          comment: input.comment,
        },
        update: { score: input.score, comment: input.comment ?? null },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitorRated,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id, score: input.score },
        metadata: { actorUserId },
      });
    });
    return this.read.getDetail(id);
  }
}
