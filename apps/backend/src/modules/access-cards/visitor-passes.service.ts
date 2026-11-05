import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FLOORS,
  formatPassNumber,
  type CreatePassesInput,
  type CreatePassesResult,
  type MarkPassesPrintedInput,
  type Paginated,
  type PassDemandRow,
  type RecordPassesInput,
  type RecordPassesResult,
  type VisitorPassDetail,
  type VisitorPassItem,
  type VisitorPassQuery,
  type VisitorPassSummary,
} from '@vms/contracts';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';

type Tx = Prisma.TransactionClient;

const cardInclude = {
  pass: {
    select: {
      visit: {
        select: { id: true, visitor: { select: { fullName: true } } },
      },
    },
  },
} satisfies Prisma.AccessCardInclude;

type CardRow = Prisma.AccessCardGetPayload<{ include: typeof cardInclude }>;

/** Per-card print stats folded from the print log. */
interface PrintStats {
  printCount: number;
  lastPrintedAt: Date | null;
  recorded: boolean;
}

const NO_PRINTS: PrintStats = {
  printCount: 0,
  lastPrintedAt: null,
  recorded: false,
};

/** Highest numeric Pass ID on a floor-wing (legacy non-numeric IDs are ignored). */
export function highestNumber(cardNumbers: string[]): number {
  return cardNumbers.reduce((max, n) => {
    const v = /^\d+$/.test(n) ? Number(n) : 0;
    return v > max ? v : max;
  }, 0);
}

/**
 * Producing visitor passes (System Admin): new runs are numbered per
 * floor-wing, existing physical passes can be recorded, and every print,
 * reprint and recording is logged per pass. Assigning stays at reception.
 */
@Injectable()
export class VisitorPassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  async list(query: VisitorPassQuery): Promise<Paginated<VisitorPassItem>> {
    const where: Prisma.AccessCardWhereInput = {
      ...(query.zone ? { zone: query.zone } : {}),
      ...(query.search ? { cardNumber: { contains: query.search } } : {}),
      ...statusWhere(query.status),
    };
    const [rows, total] = await Promise.all([
      this.prisma.accessCard.findMany({
        where,
        include: cardInclude,
        orderBy: [{ zone: 'asc' }, { cardNumber: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.accessCard.count({ where }),
    ]);
    const stats = await this.printStats(rows.map((r) => r.id));
    return {
      items: rows.map((r) => toItem(r, stats.get(r.id) ?? NO_PRINTS)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async summary(): Promise<VisitorPassSummary> {
    const [total, retired, inUse] = await Promise.all([
      this.prisma.accessCard.count(),
      this.prisma.accessCard.count({ where: { isActive: false } }),
      this.prisma.accessCard.count({
        where: { isActive: true, passId: { not: null } },
      }),
    ]);
    return { total, retired, inUse, available: total - retired - inUse };
  }

  async get(id: string): Promise<VisitorPassDetail> {
    const row = await this.prisma.accessCard.findUnique({
      where: { id },
      include: {
        ...cardInclude,
        prints: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('errors.visitorPass.notFound');
    return {
      ...toItem(row, foldPrints(row.prints)),
      prints: row.prints.map((p) => ({
        id: p.id,
        kind: p.kind,
        batchId: p.batchId,
        note: p.note,
        actorName: p.actorName,
        createdAt: p.createdAt,
      })),
      returnedAt: row.returnedAt,
      retiredAt: row.retiredAt,
      retireNote: row.retireNote,
    };
  }

  /** Visitor traffic per floor-wing vs passes in stock, to decide what to print. */
  async demand(days: number, now: Date = new Date()): Promise<PassDemandRow[]> {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const [visits, stock, inUse] = await Promise.all([
      this.prisma.visit.groupBy({
        by: ['floor'],
        where: { checkInAt: { gte: since }, floor: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.accessCard.groupBy({
        by: ['zone'],
        where: { isActive: true },
        _count: { _all: true },
      }),
      this.prisma.accessCard.groupBy({
        by: ['zone'],
        where: { isActive: true, passId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const byFloor = new Map(visits.map((v) => [v.floor, v._count._all]));
    const byZone = (rows: { zone: string; _count: { _all: number } }[]) =>
      new Map(rows.map((r) => [r.zone, r._count._all]));
    const stockBy = byZone(stock);
    const inUseBy = byZone(inUse);
    return FLOORS.map((zone) => ({
      zone,
      visits: byFloor.get(zone) ?? 0,
      stock: stockBy.get(zone) ?? 0,
      inUse: inUseBy.get(zone) ?? 0,
    }));
  }

  /** Numbers new passes after each floor-wing's highest; printing is logged separately. */
  async createBatch(
    input: CreatePassesInput,
    actorUserId: string,
  ): Promise<CreatePassesResult> {
    const batchId = randomUUID();
    const ids = await this.txm
      .run(async (tx) => {
        const created: string[] = [];
        for (const { zone, quantity } of mergeZones(input.items)) {
          const existing = await tx.accessCard.findMany({
            where: { zone },
            select: { cardNumber: true },
          });
          const start = highestNumber(existing.map((c) => c.cardNumber)) + 1;
          for (let n = start; n < start + quantity; n++) {
            const card = await tx.accessCard.create({
              data: { zone, cardNumber: formatPassNumber(n) },
              select: { id: true },
            });
            created.push(card.id);
          }
        }
        await this.publish(tx, EVENT_TYPES.VisitorPassesCreated, actorUserId, {
          batchId,
          count: created.length,
          zones: input.items.map((i) => i.zone),
        });
        return created;
      })
      .catch(conflictOnDuplicate);
    const rows = await this.prisma.accessCard.findMany({
      where: { id: { in: ids } },
      include: cardInclude,
      orderBy: [{ zone: 'asc' }, { cardNumber: 'asc' }],
    });
    return { batchId, passes: rows.map((r) => toItem(r, NO_PRINTS)) };
  }

  /** Enters passes printed before this system; IDs already on file are skipped. */
  async record(
    input: RecordPassesInput,
    actorUserId: string,
  ): Promise<RecordPassesResult> {
    const wanted: string[] = [];
    for (let n = input.from; n <= input.to; n++) {
      wanted.push(formatPassNumber(n));
    }
    const actorName = await this.actorName(actorUserId);
    return this.txm
      .run(async (tx) => {
        const existing = await tx.accessCard.findMany({
          where: { zone: input.zone, cardNumber: { in: wanted } },
          select: { cardNumber: true },
        });
        const taken = new Set(existing.map((c) => c.cardNumber));
        const fresh = wanted.filter((n) => !taken.has(n));
        for (const cardNumber of fresh) {
          await tx.accessCard.create({
            data: {
              zone: input.zone,
              cardNumber,
              prints: {
                create: {
                  kind: 'RECORDED',
                  note: input.note ?? null,
                  actorUserId,
                  actorName,
                },
              },
            },
          });
        }
        if (fresh.length > 0) {
          await this.publish(
            tx,
            EVENT_TYPES.VisitorPassesRecorded,
            actorUserId,
            {
              zone: input.zone,
              count: fresh.length,
              from: fresh[0],
              to: fresh[fresh.length - 1],
            },
          );
        }
        return { created: fresh.length, skipped: [...taken].sort() };
      })
      .catch(conflictOnDuplicate);
  }

  /** Logs a print run: a pass with any earlier print or recording counts as a reprint. */
  async markPrinted(
    input: MarkPassesPrintedInput,
    actorUserId: string,
  ): Promise<{ printed: number; reprinted: number }> {
    const actorName = await this.actorName(actorUserId);
    return this.txm.run(async (tx) => {
      const cards = await tx.accessCard.findMany({
        where: { id: { in: input.ids } },
        select: { id: true, _count: { select: { prints: true } } },
      });
      if (cards.length !== new Set(input.ids).size) {
        throw new NotFoundException('errors.visitorPass.notFound');
      }
      const entries = cards.map((c) => ({
        accessCardId: c.id,
        kind:
          c._count.prints > 0 ? ('REPRINTED' as const) : ('PRINTED' as const),
        batchId: input.batchId ?? null,
        actorUserId,
        actorName,
      }));
      await tx.accessCardPrint.createMany({ data: entries });
      const reprinted = entries.filter((e) => e.kind === 'REPRINTED').length;
      await this.publish(tx, EVENT_TYPES.VisitorPassesPrinted, actorUserId, {
        batchId: input.batchId ?? null,
        ids: cards.map((c) => c.id),
        count: entries.length,
        reprint: reprinted > 0,
        reprinted,
      });
      return { printed: entries.length - reprinted, reprinted };
    });
  }

  /** Takes a pass out of service (lost, damaged, never existed). Refused while handed out. */
  async retire(
    id: string,
    note: string | undefined,
    actorUserId: string,
  ): Promise<VisitorPassDetail> {
    await this.txm.run(async (tx) => {
      const card = await this.cardOrThrow(tx, id);
      if (card.passId) throw new ConflictException('errors.visitorPass.inUse');
      if (!card.isActive) return;
      await tx.accessCard.update({
        where: { id },
        data: {
          isActive: false,
          retiredAt: new Date(),
          retireNote: note ?? null,
        },
      });
      await this.publish(tx, EVENT_TYPES.VisitorPassRetired, actorUserId, {
        accessCardId: id,
        zone: card.zone,
        cardNumber: card.cardNumber,
        note: note ?? null,
      });
    });
    return this.get(id);
  }

  async reactivate(
    id: string,
    actorUserId: string,
  ): Promise<VisitorPassDetail> {
    await this.txm.run(async (tx) => {
      const card = await this.cardOrThrow(tx, id);
      if (card.isActive) return;
      await tx.accessCard.update({
        where: { id },
        data: { isActive: true, retiredAt: null, retireNote: null },
      });
      await this.publish(tx, EVENT_TYPES.VisitorPassReactivated, actorUserId, {
        accessCardId: id,
        zone: card.zone,
        cardNumber: card.cardNumber,
      });
    });
    return this.get(id);
  }

  private async printStats(ids: string[]): Promise<Map<string, PrintStats>> {
    if (ids.length === 0) return new Map();
    const groups = await this.prisma.accessCardPrint.groupBy({
      by: ['accessCardId', 'kind'],
      where: { accessCardId: { in: ids } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const out = new Map<string, PrintStats>();
    for (const g of groups) {
      const s = out.get(g.accessCardId) ?? { ...NO_PRINTS };
      if (g.kind === 'RECORDED') {
        s.recorded = true;
      } else {
        s.printCount += g._count._all;
        const last = g._max.createdAt;
        if (last && (!s.lastPrintedAt || last > s.lastPrintedAt)) {
          s.lastPrintedAt = last;
        }
      }
      out.set(g.accessCardId, s);
    }
    return out;
  }

  private async cardOrThrow(tx: Tx, id: string) {
    const card = await tx.accessCard.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('errors.visitorPass.notFound');
    return card;
  }

  private async actorName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    return user?.fullName ?? null;
  }

  private publish(
    tx: Tx,
    type: (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES],
    actorUserId: string,
    payload: Record<string, unknown>,
  ) {
    const id =
      (payload.accessCardId as string | undefined) ??
      (payload.batchId as string | undefined) ??
      randomUUID();
    return this.events.publish(tx, {
      type,
      aggregateType: 'VisitorPass',
      aggregateId: id,
      payload,
      metadata: { actorUserId },
    });
  }
}

function statusWhere(
  status: VisitorPassQuery['status'],
): Prisma.AccessCardWhereInput {
  switch (status) {
    case 'AVAILABLE':
      return { isActive: true, passId: null };
    case 'IN_USE':
      return { isActive: true, passId: { not: null } };
    case 'RETIRED':
      return { isActive: false };
    default:
      return {};
  }
}

/** The same floor-wing listed twice in one run is numbered as one block. */
function mergeZones(items: CreatePassesInput['items']) {
  const totals = new Map<string, number>();
  for (const { zone, quantity } of items) {
    totals.set(zone, (totals.get(zone) ?? 0) + quantity);
  }
  return [...totals].map(([zone, quantity]) => ({ zone, quantity }));
}

function foldPrints(prints: { kind: string; createdAt: Date }[]): PrintStats {
  const s = { ...NO_PRINTS };
  for (const p of prints) {
    if (p.kind === 'RECORDED') {
      s.recorded = true;
      continue;
    }
    s.printCount += 1;
    if (!s.lastPrintedAt || p.createdAt > s.lastPrintedAt) {
      s.lastPrintedAt = p.createdAt;
    }
  }
  return s;
}

function toItem(row: CardRow, stats: PrintStats): VisitorPassItem {
  const visit = row.pass?.visit ?? null;
  return {
    id: row.id,
    zone: row.zone,
    cardNumber: row.cardNumber,
    status: !row.isActive ? 'RETIRED' : row.passId ? 'IN_USE' : 'AVAILABLE',
    origin: stats.recorded
      ? 'RECORDED'
      : stats.printCount > 0
        ? 'PRINTED'
        : 'NOT_PRINTED',
    printCount: stats.printCount,
    lastPrintedAt: stats.lastPrintedAt,
    holder:
      row.passId && visit
        ? {
            visitId: visit.id,
            visitorName: visit.visitor.fullName,
            assignedAt: row.assignedAt,
          }
        : null,
    createdAt: row.createdAt,
  };
}

function conflictOnDuplicate(err: unknown): never {
  // Two runs numbered the same floor-wing at once; the unique key decides.
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new ConflictException('errors.visitorPass.numberTaken');
  }
  throw err;
}
