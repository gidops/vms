import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CheckInVisitInput,
  CheckOutVisitInput,
  CreateVisitsInput,
  Paginated,
  ResubmitVisitInput,
  UpdateVisitRequestInput,
  VisitListItem,
  VisitPass,
  VisitListQuery,
  VisitRequestDetail,
} from '@vms/contracts';
import { randomInt, randomUUID } from 'node:crypto';
import { toDataURL } from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';

const PASS_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Internal pass code, e.g. "4486-BC9C" (digits-dash-alnum). */
function generateAccessCode(): string {
  const digits = String(randomInt(1000, 10000));
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `${digits}-${suffix}`;
}

/**
 * Guest-facing invite reference code, e.g. "5A19-795" (4 alnum - 3 digits).
 * Encoded in the invite QR and printed on the success/check-in screens so the
 * VMC operator can match it against the code in the visitor's email.
 */
function generateReferenceCode(): string {
  let prefix = '';
  for (let i = 0; i < 4; i++) {
    prefix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `${prefix}-${String(randomInt(100, 1000))}`;
}

const detailInclude = Prisma.validator<Prisma.VisitInclude>()({
  visitor: true,
  host: { include: { user: true } },
  createdBy: true,
  notes: { include: { author: true }, orderBy: { createdAt: 'asc' } },
  pass: { include: { accessCard: true } },
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
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    const detail = this.toDetail(visit);
    if (visit.referenceCode) {
      detail.qrCode = await toDataURL(visit.referenceCode, {
        width: 240,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    }
    return detail;
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

  /**
   * Host edits & resubmits a request the CSO bounced back (NEEDS_MORE_INFO) —
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
    if (visit.status !== 'NEEDS_MORE_INFO') {
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
    return this.getDetail(id);
  }

  async approve(id: string, actorUserId: string): Promise<VisitRequestDetail> {
    await this.ensureExists(id);

    // Approval no longer mints a pass — the physical badge is assigned at check-in
    // (VMC). The VisitApproved notification carries the invite referenceCode/QR.
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

  /**
   * VMC creates one or more visits — the "New Invite Request" / "Register Walk-In"
   * forms. One Visit per guest (each carries its own host/floor/purpose/schedule),
   * all sharing a generated groupId so they can be checked in together. Walk-ins
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
    const groupId = randomUUID();
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

    return Promise.all(createdIds.map((id) => this.getDetail(id)));
  }

  /**
   * Paginated visit list (newest first). The admin approval queue passes no
   * scope; the staff dashboard passes `scope: "mine"` to restrict the result to
   * visits the requesting user hosts. `type`/`purpose` and the
   * `dateFrom`/`dateTo` window (over the scheduled date) are the staff facets.
   */
  async list(
    query: VisitListQuery,
    currentUserId: string,
  ): Promise<Paginated<VisitListItem>> {
    const where: Prisma.VisitWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.purpose) where.purpose = query.purpose;
    if (query.groupId) where.groupId = query.groupId;
    if (query.scope === 'mine') where.host = { userId: currentUserId };
    if (query.dateFrom || query.dateTo) {
      where.scheduledAt = {
        ...(query.dateFrom ? { gte: query.dateFrom } : {}),
        ...(query.dateTo ? { lte: query.dateTo } : {}),
      };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.visit.findMany({
        where,
        include: { visitor: true, host: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.visit.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toListItem(r)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

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
    return this.getDetail(id);
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
    await this.ensureExists(id);
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
    if (count === 0) throw new NotFoundException('errors.visit.notFound');
  }

  private toHost(host: VisitDetailRow['host']): VisitRequestDetail['host'] {
    if (!host) return null;
    return {
      id: host.id,
      userId: host.userId,
      department: host.department,
      office: host.office,
      createdAt: host.createdAt,
      updatedAt: host.updatedAt,
      user: {
        id: host.user.id,
        fullName: host.user.fullName,
        email: host.user.email,
      },
    };
  }

  private toPass(pass: VisitDetailRow['pass']): VisitPass | null {
    if (!pass?.accessCard) return null;
    return {
      cardNumber: pass.accessCard.cardNumber,
      zone: pass.accessCard.zone,
      status: pass.status,
      assignedAt: pass.accessCard.assignedAt,
    };
  }

  private toDetail(visit: VisitDetailRow): VisitRequestDetail {
    return {
      id: visit.id,
      visitorId: visit.visitorId,
      hostId: visit.hostId,
      invitationId: visit.invitationId,
      groupId: visit.groupId,
      referenceCode: visit.referenceCode,
      type: visit.type,
      status: visit.status,
      purpose: visit.purpose,
      floor: visit.floor,
      riskLevel: visit.riskLevel,
      scheduledAt: visit.scheduledAt,
      gateValidatedAt: visit.gateValidatedAt,
      checkInAt: visit.checkInAt,
      checkOutAt: visit.checkOutAt,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
      source: visit.source,
      createdById: visit.createdById,
      createdByName: visit.createdByName ?? visit.createdBy?.fullName ?? null,
      visitor: visit.visitor,
      host: this.toHost(visit.host),
      pass: this.toPass(visit.pass),
      notes: visit.notes.map((note) => ({
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

  private toListItem(
    visit: Prisma.VisitGetPayload<{
      include: { visitor: true; host: { include: { user: true } } };
    }>,
  ): VisitListItem {
    return {
      id: visit.id,
      visitorId: visit.visitorId,
      hostId: visit.hostId,
      invitationId: visit.invitationId,
      groupId: visit.groupId,
      referenceCode: visit.referenceCode,
      type: visit.type,
      status: visit.status,
      purpose: visit.purpose,
      floor: visit.floor,
      riskLevel: visit.riskLevel,
      scheduledAt: visit.scheduledAt,
      gateValidatedAt: visit.gateValidatedAt,
      checkInAt: visit.checkInAt,
      checkOutAt: visit.checkOutAt,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
      createdByName: visit.createdByName,
      visitor: visit.visitor,
      host: this.toHost(visit.host),
    };
  }
}
