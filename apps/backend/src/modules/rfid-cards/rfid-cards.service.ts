import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AssignRfidCardInput,
  CloseRfidAssignmentInput,
  Paginated,
  PresignResult,
  RfidAssignmentDetail,
  RfidAssignmentItem,
  RfidAssignmentListQuery,
  RfidCardItem,
  RfidCardListQuery,
  SetRfidCardStatusInput,
  UpdateRfidAssignmentInput,
  AvatarContentType,
  HeldRfidCard,
} from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { heldRfidCards } from './held-cards';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import {
  S3Service,
  VISITOR_PHOTO_PREFIX,
} from '../../shared/storage/s3.service';

const assignmentInclude = {
  card: { select: { id: true, cardNumber: true } },
  visitor: {
    select: { id: true, fullName: true, email: true, organization: true },
  },
  issuedBy: { select: { fullName: true } },
  returnedBy: { select: { fullName: true } },
} satisfies Prisma.RfidCardAssignmentInclude;

type AssignmentRow = Prisma.RfidCardAssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;

type Tx = Prisma.TransactionClient;

/** Only keys we issued for visitor photos may be stored (never e.g. avatars). */
function assertPhotoKey(key: string | undefined): void {
  if (key !== undefined && !key.startsWith(VISITOR_PHOTO_PREFIX)) {
    throw new BadRequestException('errors.rfid.invalidPhoto');
  }
}

/** At most one ACTIVE assignment per card and per visitor: the card is claimed conditionally and the visitor row locked, in one transaction. */
@Injectable()
export class RfidCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly s3: S3Service,
  ) {}

  toItem(row: AssignmentRow, now: Date = new Date()): RfidAssignmentItem {
    return {
      id: row.id,
      status: row.status,
      card: row.card,
      visitor: row.visitor,
      visitId: row.visitId,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      overdue: row.status === 'ACTIVE' && row.validUntil < now,
      hasPhoto: !!row.photoKey,
      issuedAt: row.issuedAt,
      issuedByName: row.issuedBy?.fullName ?? null,
      printCount: row.printCount,
      lastPrintedAt: row.lastPrintedAt,
      returnedAt: row.returnedAt,
      returnedByName: row.returnedBy?.fullName ?? null,
      closeNote: row.closeNote,
      notes: row.notes,
    };
  }

  presignPhoto(contentType: AvatarContentType): Promise<PresignResult> {
    return this.s3.presignVisitorPhoto(contentType);
  }

  async listAssignments(
    query: RfidAssignmentListQuery,
  ): Promise<Paginated<RfidAssignmentItem>> {
    const contains = query.search
      ? ({ contains: query.search, mode: 'insensitive' } as const)
      : undefined;
    const where: Prisma.RfidCardAssignmentWhereInput = {
      status: query.view === 'active' ? 'ACTIVE' : { not: 'ACTIVE' },
      ...(query.cardId ? { cardId: query.cardId } : {}),
      ...(contains
        ? {
            OR: [
              { card: { cardNumber: contains } },
              { visitor: { fullName: contains } },
              { visitor: { email: contains } },
              { visitor: { organization: contains } },
            ],
          }
        : {}),
    };
    // Active: soonest to expire first (overdue on top). History: latest first.
    const orderBy: Prisma.RfidCardAssignmentOrderByWithRelationInput[] =
      query.view === 'active'
        ? [{ validUntil: 'asc' }, { id: 'asc' }]
        : [{ returnedAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      this.prisma.rfidCardAssignment.findMany({
        where,
        include: assignmentInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.rfidCardAssignment.count({ where }),
    ]);
    const now = new Date();
    return {
      items: rows.map((r) => this.toItem(r, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getAssignment(id: string): Promise<RfidAssignmentDetail> {
    const row = await this.prisma.rfidCardAssignment.findUnique({
      where: { id },
      include: {
        ...assignmentInclude,
        visit: {
          select: { id: true, status: true, scheduledAt: true, purpose: true },
        },
      },
    });
    if (!row) throw new NotFoundException('errors.rfid.notFound');
    return {
      ...this.toItem(row),
      photoKey: row.photoKey,
      photoUrl: row.photoKey ? await this.s3.presignGet(row.photoKey) : null,
      visit: row.visit,
    };
  }

  async listCards(query: RfidCardListQuery): Promise<Paginated<RfidCardItem>> {
    const where: Prisma.RfidCardWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                cardNumber: { contains: query.search, mode: 'insensitive' },
              },
              {
                assignments: {
                  some: {
                    status: 'ACTIVE',
                    visitor: {
                      fullName: { contains: query.search, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.rfidCard.findMany({
        where,
        orderBy: { cardNumber: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          _count: { select: { assignments: true } },
          assignments: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: {
              id: true,
              validUntil: true,
              visitor: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.rfidCard.count({ where }),
    ]);
    return {
      items: rows.map((c) => {
        const open = c.assignments[0];
        return {
          id: c.id,
          cardNumber: c.cardNumber,
          status: c.status,
          notes: c.notes,
          timesIssued: c._count.assignments,
          current: open
            ? {
                assignmentId: open.id,
                visitorName: open.visitor.fullName,
                validUntil: open.validUntil,
              }
            : null,
          createdAt: c.createdAt,
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async assign(
    input: AssignRfidCardInput,
    actorUserId: string,
  ): Promise<RfidAssignmentDetail> {
    assertPhotoKey(input.photoKey);
    const id = await this.txm.run(async (tx) => {
      const visitor = await tx.visitor.findUnique({
        where: { id: input.visitorId },
        select: { id: true },
      });
      if (!visitor) throw new NotFoundException('errors.visitor.notFound');
      // Serialise assignments for this visitor (one active card each).
      await tx.$queryRaw`SELECT id FROM "Visitor" WHERE id = ${input.visitorId} FOR UPDATE`;
      if (input.visitId) {
        const visit = await tx.visit.findUnique({
          where: { id: input.visitId },
          select: { visitorId: true },
        });
        if (!visit || visit.visitorId !== input.visitorId) {
          throw new BadRequestException('errors.rfid.visitMismatch');
        }
      }
      const holding = await tx.rfidCardAssignment.findFirst({
        where: { visitorId: input.visitorId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (holding) {
        throw new ConflictException('errors.rfid.visitorHasCard');
      }
      const card = await tx.rfidCard.upsert({
        where: { cardNumber: input.cardNumber },
        create: { cardNumber: input.cardNumber },
        update: {},
      });
      await this.claim(tx, card.id, card.status);
      const row = await tx.rfidCardAssignment.create({
        data: {
          cardId: card.id,
          visitorId: input.visitorId,
          visitId: input.visitId ?? null,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          photoKey: input.photoKey ?? null,
          notes: input.notes ?? null,
          issuedById: actorUserId,
        },
      });
      await this.publish(
        tx,
        EVENT_TYPES.RfidCardAssigned,
        row.id,
        actorUserId,
        {
          cardId: card.id,
          cardNumber: card.cardNumber,
          visitorId: input.visitorId,
          visitId: input.visitId ?? null,
          validFrom: input.validFrom.toISOString(),
          validUntil: input.validUntil.toISOString(),
        },
      );
      return row.id;
    });
    return this.getAssignment(id);
  }

  private async claim(tx: Tx, cardId: string, status: string): Promise<void> {
    const claimed = await tx.rfidCard.updateMany({
      where: { id: cardId, status: 'AVAILABLE' },
      data: { status: 'ASSIGNED' },
    });
    if (claimed.count === 1) return;
    if (status === 'LOST') throw new ConflictException('errors.rfid.cardLost');
    if (status === 'RETIRED') {
      throw new ConflictException('errors.rfid.cardRetired');
    }
    throw new ConflictException('errors.rfid.cardInUse');
  }

  async update(
    id: string,
    input: UpdateRfidAssignmentInput,
    actorUserId: string,
  ): Promise<RfidAssignmentDetail> {
    assertPhotoKey(input.photoKey);
    await this.txm.run(async (tx) => {
      const row = await this.activeOrThrow(tx, id);
      if (input.validUntil && input.validUntil <= row.validFrom) {
        throw new BadRequestException('errors.rfid.invalidValidity');
      }
      await tx.rfidCardAssignment.update({
        where: { id },
        data: {
          ...(input.validUntil ? { validUntil: input.validUntil } : {}),
          ...(input.photoKey ? { photoKey: input.photoKey } : {}),
          ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        },
      });
      await this.publish(tx, EVENT_TYPES.RfidCardUpdated, id, actorUserId, {
        cardId: row.cardId,
        ...(input.validUntil
          ? {
              validUntil: input.validUntil.toISOString(),
              previousValidUntil: row.validUntil.toISOString(),
            }
          : {}),
        photoChanged: !!input.photoKey,
        notesChanged: input.notes !== undefined,
      });
    });
    return this.getAssignment(id);
  }

  async printed(
    id: string,
    actorUserId: string,
  ): Promise<RfidAssignmentDetail> {
    await this.txm.run(async (tx) => {
      const row = await this.activeOrThrow(tx, id);
      const updated = await tx.rfidCardAssignment.update({
        where: { id },
        data: { printCount: { increment: 1 }, lastPrintedAt: new Date() },
      });
      await this.publish(tx, EVENT_TYPES.RfidCardPrinted, id, actorUserId, {
        cardId: row.cardId,
        printCount: updated.printCount,
        reprint: updated.printCount > 1,
      });
    });
    return this.getAssignment(id);
  }

  async close(
    id: string,
    input: CloseRfidAssignmentInput,
    actorUserId: string,
  ): Promise<RfidAssignmentDetail> {
    await this.txm.run((tx) => this.closeInTx(tx, id, input, actorUserId));
    return this.getAssignment(id);
  }

  /**
   * Closes an active assignment inside the caller's transaction. Shared by the
   * Operations screen and visit check-out, so both free or lose the card and
   * audit it the same way.
   */
  async closeInTx(
    tx: Tx,
    id: string,
    input: CloseRfidAssignmentInput,
    actorUserId: string,
  ): Promise<void> {
    const row = await this.activeOrThrow(tx, id);
    await tx.rfidCardAssignment.update({
      where: { id },
      data: {
        status: input.outcome,
        returnedAt: new Date(),
        returnedById: actorUserId,
        closeNote: input.note || null,
      },
    });
    await tx.rfidCard.update({
      where: { id: row.cardId },
      data: { status: input.outcome === 'RETURNED' ? 'AVAILABLE' : 'LOST' },
    });
    await this.publish(
      tx,
      input.outcome === 'RETURNED'
        ? EVENT_TYPES.RfidCardReturned
        : EVENT_TYPES.RfidCardLost,
      id,
      actorUserId,
      { cardId: row.cardId, visitorId: row.visitorId, note: input.note },
    );
  }

  heldCards(
    visitorIds: string[],
    now = new Date(),
    db: Tx | PrismaService = this.prisma,
  ): Promise<Map<string, HeldRfidCard>> {
    return heldRfidCards(db, visitorIds, now);
  }

  async setCardStatus(
    cardId: string,
    input: SetRfidCardStatusInput,
    actorUserId: string,
  ): Promise<void> {
    await this.txm.run(async (tx) => {
      const card = await tx.rfidCard.findUnique({ where: { id: cardId } });
      if (!card) throw new NotFoundException('errors.rfid.cardNotFound');
      if (card.status === 'ASSIGNED') {
        throw new ConflictException('errors.rfid.cardInUse');
      }
      await tx.rfidCard.update({
        where: { id: cardId },
        data: {
          status: input.status,
          ...(input.note !== undefined ? { notes: input.note || null } : {}),
        },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.RfidCardStatusChanged,
        aggregateType: 'RfidCard',
        aggregateId: cardId,
        payload: {
          cardNumber: card.cardNumber,
          from: card.status,
          to: input.status,
          note: input.note,
        },
        metadata: { actorUserId },
      });
    });
  }

  private async activeOrThrow(tx: Tx, id: string) {
    const row = await tx.rfidCardAssignment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('errors.rfid.notFound');
    if (row.status !== 'ACTIVE') {
      throw new ConflictException('errors.rfid.notActive');
    }
    return row;
  }

  private publish(
    tx: Tx,
    type: (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES],
    assignmentId: string,
    actorUserId: string,
    payload: Record<string, unknown>,
  ) {
    return this.events.publish(tx, {
      type,
      aggregateType: 'RfidCardAssignment',
      aggregateId: assignmentId,
      payload: { assignmentId, ...payload },
      metadata: { actorUserId },
    });
  }
}
