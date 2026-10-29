import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ROLES,
  VISIT_SOURCE_DESK_QR,
  normalizeConsentEmail,
  type CreateVisitsInput,
  type PublicRegistrationInput,
  type PublicRegistrationResult,
  type ResubmitVisitInput,
  type UpdateVisitRequestInput,
  type VisitRequestDetail,
} from '@vms/contracts';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { evacuationAssistData } from './helpers/evacuation-assist';
import { generateReferenceCode } from './helpers/visit.codes';
import { VisitReadService } from './read.service';

@Injectable()
export class VisitAuthoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly read: VisitReadService,
  ) {}

  /** Walk-ins are auto-approved (badge assigned at check-in); invites start PENDING with a reference + QR. */
  async createVisits(
    input: CreateVisitsInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail[]> {
    const isWalkIn = input.type === 'WALK_IN';

    const hostUserIds = [
      ...new Set(input.guests.map((g) => g.hostUserId).filter(Boolean)),
    ] as string[];
    if (hostUserIds.length > 0) {
      await this.assertActiveHosts(hostUserIds);
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { fullName: true },
    });
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
            // Walk-ins get one too so reception can quote it; only invites send it out.
            referenceCode: generateReferenceCode(),
            type: input.type,
            status: isWalkIn ? 'APPROVED' : 'PENDING',
            purpose: g.purpose,
            floor: g.floor,
            scheduledAt: g.scheduledAt ?? (isWalkIn ? new Date() : null),
            approvedById: isWalkIn ? actorUserId : null,
            createdById: actorUserId,
            createdByName: actor?.fullName ?? null,
            source: 'VMC_STATION',
            needsEvacuationAssist: g.needsEvacuationAssist,
            ...evacuationAssistData(g),
            commsConsent: g.commsConsent,
          },
        });
        createdIds.push(visit.id);

        // Latest consent event per normalised email is that person's current opt-in.
        await tx.commsConsentEvent.create({
          data: {
            email: normalizeConsentEmail(g.email),
            consent: g.commsConsent,
            source: 'VISIT',
            visitId: visit.id,
            actorUserId,
          },
        });

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

  /** Public-form walk-in: never overwrites an existing visitor's saved details, since anyone can type any email. */
  async createSelfRegisteredWalkIn(
    input: Omit<PublicRegistrationInput, 'formToken' | 'website'>,
    onCreated?: (
      tx: Prisma.TransactionClient,
      visitId: string,
    ) => Promise<void>,
  ): Promise<PublicRegistrationResult> {
    if (input.hostUserId) await this.assertActiveHosts([input.hostUserId]);

    return this.txm.run(async (tx) => {
      const hostId = input.hostUserId
        ? (
            await tx.host.upsert({
              where: { userId: input.hostUserId },
              create: { userId: input.hostUserId },
              update: {},
            })
          ).id
        : null;
      const existing = await tx.visitor.findUnique({
        where: { email: input.email },
      });
      const visitor =
        existing ??
        (await tx.visitor.create({
          data: {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            organization: input.organization,
          },
        }));
      const visit = await tx.visit.create({
        data: {
          visitorId: visitor.id,
          hostId,
          referenceCode: generateReferenceCode(),
          type: 'WALK_IN',
          status: 'APPROVED',
          purpose: input.purpose,
          floor: input.floor,
          scheduledAt: new Date(),
          source: VISIT_SOURCE_DESK_QR,
          visitorNameAtVisit: input.fullName,
          organizationAtVisit: input.organization,
          needsEvacuationAssist: input.needsEvacuationAssist,
          ...evacuationAssistData(input),
          commsConsent: input.commsConsent,
        },
        include: { host: { include: { user: true } } },
      });
      // The email isn't verified on the public form, so it may only set consent
      // for a visitor it creates, never change an existing person's choice.
      if (!existing) {
        await tx.commsConsentEvent.create({
          data: {
            email: normalizeConsentEmail(input.email),
            consent: input.commsConsent,
            source: 'VISIT',
            visitId: visit.id,
          },
        });
      }
      await this.events.publish(tx, {
        type: EVENT_TYPES.VisitApproved,
        aggregateType: 'Visit',
        aggregateId: visit.id,
        payload: { visitId: visit.id, source: VISIT_SOURCE_DESK_QR },
      });
      await onCreated?.(tx, visit.id);
      return {
        fullName: input.fullName,
        hostName: visit.host?.user.fullName ?? null,
        visitDate: visit.scheduledAt!,
      };
    });
  }

  /** Creator-only edit, allowed while PENDING/REVIEW_REQUESTED; approved requests are locked. */
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
    if (input.hostUserId) await this.assertActiveHosts([input.hostUserId]);

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
          needsEvacuationAssist: input.needsEvacuationAssist,
          ...(input.needsEvacuationAssist === undefined
            ? {}
            : evacuationAssistData({
                needsEvacuationAssist: input.needsEvacuationAssist,
                evacuationAssistTypes: input.evacuationAssistTypes,
                evacuationAssistOther: input.evacuationAssistOther,
              })),
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

  /** Authorized by host ownership so STAFF needs no global `visit:edit`. */
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

  /** Every host must be an active staff member; deactivated accounts can't host. */
  private async assertActiveHosts(userIds: string[]): Promise<void> {
    const ids = [...new Set(userIds)];
    const count = await this.prisma.user.count({
      where: {
        id: { in: ids },
        isActive: true,
        userRoles: { some: { role: { name: ROLES.STAFF } } },
      },
    });
    if (count !== ids.length) {
      throw new BadRequestException('errors.host.notStaff');
    }
  }
}
