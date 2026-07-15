import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateVisitsInput,
  ResubmitVisitInput,
  UpdateVisitRequestInput,
  VisitRequestDetail,
} from '@vms/contracts';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { generateReferenceCode } from './helpers/visit.codes';
import { VisitReadService } from './read.service';

/**
 * Authoring side of the visits module: creating visit requests / walk-ins and
 * the pre-approval edits the creator (VMC operator) or host may make — update,
 * resubmit, cancel, and re-sending the invite code.
 */
@Injectable()
export class VisitAuthoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly read: VisitReadService,
  ) {}

  /**
   * VMC creates one or more visits — the "New Invite Request" / "Register Walk-In"
   * forms. One Visit per guest (each carries its own host/floor/purpose/schedule).
   * A true group visit (`isGroupVisit`) shares one generated groupId + groupName/
   * groupContact across all guests so it collapses to one VMC row and checks in as a
   * group; a bulk submission leaves each visit independent (groupId = null). Walk-ins
   * are auto-approved and emit VisitApproved (no pass, no QR, no visitor email —
   * the badge is assigned at check-in). Invites start PENDING, get a referenceCode
   * + QR for the guest, and emit VisitRequested. All atomic in one transaction.
   */
  async createVisits(
    input: CreateVisitsInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail[]> {
    const isWalkIn = input.type === 'WALK_IN';

    // Every named host must be a user with the STAFF role.
    const hostUserIds = [
      ...new Set(input.guests.map((g) => g.hostUserId).filter(Boolean)),
    ] as string[];
    if (hostUserIds.length > 0) {
      const staff = await this.prisma.user.findMany({
        where: {
          id: { in: hostUserIds },
          userRoles: { some: { role: { name: 'STAFF' } } },
        },
        select: { id: true },
      });
      if (staff.length !== hostUserIds.length) {
        throw new BadRequestException('errors.host.notStaff');
      }
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { fullName: true },
    });
    // A group shares one id + name/email; a bulk submission has no shared group.
    const groupId = input.isGroupVisit ? randomUUID() : null;
    const groupName = input.isGroupVisit ? (input.groupName ?? null) : null;
    const groupContact = input.isGroupVisit
      ? (input.groupContact ?? null)
      : null;
    const createdIds: string[] = [];

    await this.txm.run(async (tx) => {
      for (const g of input.guests) {
        const hostId = g.hostUserId
          ? (
              await tx.host.upsert({
                where: { userId: g.hostUserId },
                create: { userId: g.hostUserId },
                update: {},
              })
            ).id
          : null;

        const visitor = await tx.visitor.upsert({
          where: { email: g.email },
          create: {
            fullName: g.fullName,
            email: g.email,
            phone: g.phone,
            organization: g.organization,
          },
          update: {
            fullName: g.fullName,
            phone: g.phone ?? undefined,
            organization: g.organization ?? undefined,
          },
        });

        const visit = await tx.visit.create({
          data: {
            visitorId: visitor.id,
            hostId,
            groupId,
            isGroupVisit: input.isGroupVisit,
            groupName,
            groupContact,
            referenceCode: isWalkIn ? null : generateReferenceCode(),
            type: input.type,
            status: isWalkIn ? 'APPROVED' : 'PENDING',
            purpose: g.purpose,
            floor: g.floor,
            scheduledAt: g.scheduledAt ?? (isWalkIn ? new Date() : null),
            approvedById: isWalkIn ? actorUserId : null,
            createdById: actorUserId,
            createdByName: actor?.fullName ?? null,
            source: 'VMC_STATION',
          },
        });
        createdIds.push(visit.id);

        if (g.notes) {
          await tx.note.create({
            data: {
              visitId: visit.id,
              authorId: actorUserId,
              authorName: actor?.fullName ?? '',
              body: g.notes,
            },
          });
        }

        await this.events.publish(tx, {
          type: isWalkIn
            ? EVENT_TYPES.VisitApproved
            : EVENT_TYPES.VisitRequested,
          aggregateType: 'Visit',
          aggregateId: visit.id,
          payload: { visitId: visit.id },
          metadata: { actorUserId },
        });
      }
    });

    return Promise.all(createdIds.map((id) => this.read.getDetail(id)));
  }

  /**
   * VMC edit of a not-yet-approved request via the pre-filled invite form —
   * covers visitor details and that visit's details. Only the creator can edit,
   * and only while the request is still PENDING/REVIEW_REQUESTED (an approved
   * request is locked). A named host must still be a STAFF user.
   */
  async update(
    id: string,
    input: UpdateVisitRequestInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: { status: true, createdById: true, visitorId: true },
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    if (visit.createdById !== actorUserId) {
      throw new ForbiddenException('errors.visit.notOwner');
    }
    if (visit.status !== 'PENDING' && visit.status !== 'REVIEW_REQUESTED') {
      throw new BadRequestException('errors.visit.notEditable');
    }
    if (input.hostUserId) {
      const staff = await this.prisma.user.findFirst({
        where: {
          id: input.hostUserId,
          userRoles: { some: { role: { name: 'STAFF' } } },
        },
        select: { id: true },
      });
      if (!staff) throw new BadRequestException('errors.host.notStaff');
    }

    const visitorData = {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      organization: input.organization,
    };
    const hasVisitorChange = Object.values(visitorData).some(
      (v) => v !== undefined,
    );

    await this.txm.run(async (tx) => {
      if (hasVisitorChange) {
        await tx.visitor.update({
          where: { id: visit.visitorId },
          data: visitorData,
        });
      }
      const hostId = input.hostUserId
        ? (
            await tx.host.upsert({
              where: { userId: input.hostUserId },
              create: { userId: input.hostUserId },
              update: {},
            })
          ).id
        : undefined;
      await tx.visit.update({
        where: { id },
        data: {
          ...(hostId ? { hostId } : {}),
          floor: input.floor,
          purpose: input.purpose,
          scheduledAt: input.scheduledAt,
        },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitUpdated,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id, ...input },
        metadata: { actorUserId },
      });
    });
    return this.read.getDetail(id);
  }

  /**
   * Host edits & resubmits a request the Security Manager bounced back (REVIEW_REQUESTED) —
   * optionally updating purpose/schedule — moving it back to PENDING for review.
   * Authorized by host ownership so STAFF needs no global visit:edit permission.
   */
  async resubmit(
    id: string,
    input: ResubmitVisitInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: { id: true, status: true, host: { select: { userId: true } } },
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    if (visit.host?.userId !== actorUserId) {
      throw new ForbiddenException('errors.visit.notOwner');
    }
    if (visit.status !== 'REVIEW_REQUESTED') {
      throw new BadRequestException('errors.visit.notResubmittable');
    }
    await this.txm.run(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: {
          status: 'PENDING',
          ...(input.purpose ? { purpose: input.purpose } : {}),
          ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
        },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitRequested,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id, resubmitted: true },
        metadata: { actorUserId },
      });
    });
    return this.read.getDetail(id);
  }

  async cancel(id: string, actorUserId: string): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: { createdById: true, host: { select: { userId: true } } },
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    // The creator (e.g. the VMC operator who logged it) or the host may cancel.
    if (
      visit.createdById !== actorUserId &&
      visit.host?.userId !== actorUserId
    ) {
      throw new ForbiddenException('errors.visit.notOwner');
    }
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
    return this.read.getDetail(id);
  }

  /**
   * Re-send the invite code/QR email to the guest. Only the host or creator may
   * trigger it, and only for an invite that still carries a reference code.
   */
  async resendCode(
    id: string,
    actorUserId: string,
  ): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: {
        type: true,
        referenceCode: true,
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
    if (visit.type === 'WALK_IN' || !visit.referenceCode) {
      throw new BadRequestException('errors.visit.invalidState');
    }
    await this.txm.run(async (tx) => {
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitInviteResent,
        aggregateType: 'Visit',
        aggregateId: id,
        payload: { visitId: id },
        metadata: { actorUserId },
      });
    });
    return this.read.getDetail(id);
  }
}
