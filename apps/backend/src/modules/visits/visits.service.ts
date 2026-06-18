import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateVisitsInput,
  Paginated,
  UpdateVisitRequestInput,
  VisitListItem,
  VisitListQuery,
  VisitRequestDetail,
} from '@vms/contracts';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';

const PASS_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human-friendly access code, e.g. "4486-BC9C" (digits-dash-alnum). */
function generateAccessCode(): string {
  const digits = String(randomInt(1000, 10000));
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `${digits}-${suffix}`;
}

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
    if (!visit) throw new NotFoundException('errors.visit.notFound');
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
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: { id: true, scheduledAt: true },
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');

    // Mint the access pass (code + expiry) atomically with the approval, so the
    // VisitApproved notification can include the code + QR.
    await this.txm.run(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: actorUserId },
      });
      await this.mintPass(tx, id, visit.scheduledAt);
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
   * VMC creates one or more visits for a host. One Visit per visitor (each
   * independently approvable). Walk-ins are auto-approved (pass minted + the
   * VisitApproved notification fires); invites start PENDING and emit
   * VisitRequested for the audit trail. All atomic in one transaction.
   */
  async createVisits(
    input: CreateVisitsInput,
    actorUserId: string,
  ): Promise<VisitRequestDetail[]> {
    // Host must be a user with the STAFF role.
    const staff = await this.prisma.user.findFirst({
      where: {
        id: input.hostUserId,
        userRoles: { some: { role: { name: 'STAFF' } } },
      },
      select: { id: true },
    });
    if (!staff) throw new BadRequestException('errors.host.notStaff');

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { fullName: true },
    });
    const isWalkIn = input.type === 'WALK_IN';
    const createdIds: string[] = [];

    await this.txm.run(async (tx) => {
      const host = await tx.host.upsert({
        where: { userId: input.hostUserId },
        create: { userId: input.hostUserId },
        update: {},
      });

      for (const v of input.visitors) {
        const visitor = await tx.visitor.upsert({
          where: { email: v.email },
          create: {
            fullName: v.fullName,
            email: v.email,
            phone: v.phone,
            organization: v.organization,
          },
          update: {
            fullName: v.fullName,
            phone: v.phone ?? undefined,
            organization: v.organization ?? undefined,
          },
        });

        const visit = await tx.visit.create({
          data: {
            visitorId: visitor.id,
            hostId: host.id,
            type: input.type,
            status: isWalkIn ? 'APPROVED' : 'PENDING',
            purpose: input.purpose,
            floor: input.floor,
            scheduledAt: input.scheduledAt ?? (isWalkIn ? new Date() : null),
            approvedById: isWalkIn ? actorUserId : null,
            createdById: actorUserId,
            createdByName: actor?.fullName ?? null,
            source: 'VMC_STATION',
          },
        });
        createdIds.push(visit.id);

        if (input.notes) {
          await tx.note.create({
            data: {
              visitId: visit.id,
              authorId: actorUserId,
              authorName: actor?.fullName ?? '',
              body: input.notes,
            },
          });
        }

        if (isWalkIn) {
          await this.mintPass(tx, visit.id, visit.scheduledAt);
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

  /** Paginated visit list for the admin approval queue (newest first). */
  async list(query: VisitListQuery): Promise<Paginated<VisitListItem>> {
    const where: Prisma.VisitWhereInput = query.status
      ? { status: query.status }
      : {};
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

  /** Mint/refresh the access pass for a visit (idempotent on visitId). */
  private async mintPass(
    tx: Prisma.TransactionClient,
    visitId: string,
    scheduledAt: Date | null,
  ): Promise<void> {
    const expiresAt = new Date(
      (scheduledAt ?? new Date()).getTime() + PASS_TTL_MS,
    );
    await tx.pass.upsert({
      where: { visitId },
      create: {
        visitId,
        code: generateAccessCode(),
        status: 'ISSUED',
        expiresAt,
      },
      update: { status: 'ISSUED', expiresAt },
    });
  }

  /** Gate check-in: mark the visitor on-site, activate the pass, log the gate event. */
  async checkIn(id: string, actorUserId: string): Promise<VisitRequestDetail> {
    await this.ensureExists(id);
    await this.txm.run(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: { status: 'CHECKED_IN', checkInAt: new Date() },
      });
      await tx.pass.updateMany({
        where: { visitId: id },
        data: { status: 'ACTIVE' },
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

  /** Gate check-out: mark the visitor off-site, return the pass, log the gate event. */
  async checkOut(id: string, actorUserId: string): Promise<VisitRequestDetail> {
    await this.ensureExists(id);
    await this.txm.run(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: { status: 'CHECKED_OUT', checkOutAt: new Date() },
      });
      await tx.pass.updateMany({
        where: { visitId: id },
        data: { status: 'RETURNED', returnedAt: new Date() },
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

  private toDetail(visit: VisitDetailRow): VisitRequestDetail {
    return {
      id: visit.id,
      visitorId: visit.visitorId,
      hostId: visit.hostId,
      invitationId: visit.invitationId,
      type: visit.type,
      status: visit.status,
      purpose: visit.purpose,
      floor: visit.floor,
      riskLevel: visit.riskLevel,
      scheduledAt: visit.scheduledAt,
      checkInAt: visit.checkInAt,
      checkOutAt: visit.checkOutAt,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
      source: visit.source,
      createdById: visit.createdById,
      createdByName: visit.createdByName ?? visit.createdBy?.fullName ?? null,
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
      type: visit.type,
      status: visit.status,
      purpose: visit.purpose,
      floor: visit.floor,
      riskLevel: visit.riskLevel,
      scheduledAt: visit.scheduledAt,
      checkInAt: visit.checkInAt,
      checkOutAt: visit.checkOutAt,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
      createdByName: visit.createdByName,
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
    };
  }
}
