import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
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
import { RfidCardsService } from '../rfid-cards/rfid-cards.service';
import { VisitReadService } from './read.service';

@Injectable()
export class VisitAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly read: VisitReadService,
    private readonly rfid: RfidCardsService,
  ) {}

  /** Also stamps gate validation when the visitor skipped the gate scan; an earlier gate time is kept. */
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

    // A RESTRICTED_MATCH alert can sit on an otherwise-approved visit, so check open security alerts too.
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

  /** `accessCardId` lets the operator correct the recorded badge before it is released. */
  /**
   * A visitor holding a personalised RFID card can't leave without the desk
   * recording whether it came back; closing it shares this transaction.
   */
  async checkOut(
    id: string,
    input: CheckOutVisitInput,
    actorUserId: string,
    canReturnCards = false,
  ): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: { visitorId: true },
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    const now = new Date();
    await this.txm.run(async (tx) => {
      const held = (await this.rfid.heldCards([visit.visitorId], now, tx)).get(
        visit.visitorId,
      );
      if (held) {
        if (!input.rfidCard) {
          throw new UnprocessableEntityException('errors.rfid.returnRequired');
        }
        if (!canReturnCards) {
          throw new ForbiddenException('errors.rfid.returnNotAllowed');
        }
        await this.rfid.closeInTx(
          tx,
          held.assignmentId,
          input.rfidCard,
          actorUserId,
        );
      }
      const pass = await tx.pass.findUnique({
        where: { visitId: id },
        include: { accessCard: true },
      });
      if (pass) {
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

  /** Host or creator only, after check-out; idempotent per visit. */
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
