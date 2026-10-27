import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Paginated,
  VisitListItem,
  VisitListQuery,
  VisitRequestDetail,
} from '@vms/contracts';
import { toDataURL } from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { heldRfidCards } from '../rfid-cards/held-cards';
import {
  GROUP_INACTIVE_STATUSES,
  buildOrderBy,
  deriveGroupStatus,
} from './helpers/visit.grouping';
import {
  type VisitListRow,
  detailInclude,
  listInclude,
  toDetail,
  toListItem,
} from './helpers/visit.mappers';

/** Phone digits to match (local leading 0 dropped for +234), or null if not a phone search. */
export function phoneSearchDigits(search: string): string | null {
  if (!/^[\d\s()+-]+$/.test(search)) return null;
  const digits = search.replace(/\D/g, '').replace(/^0/, '');
  return digits.length >= 6 ? digits : null;
}

@Injectable()
export class VisitReadService {
  constructor(private readonly prisma: PrismaService) {}

  /** Without `visit:read`, others' visits read as "not found" so their existence isn't confirmed. */
  async assertCanView(id: string, userId: string): Promise<void> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      select: { createdById: true, host: { select: { userId: true } } },
    });
    if (
      !visit ||
      (visit.createdById !== userId && visit.host?.userId !== userId)
    ) {
      throw new NotFoundException('errors.visit.notFound');
    }
  }

  async getDetail(id: string): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    const detail = toDetail(visit);
    detail.rfidCard =
      (await heldRfidCards(this.prisma, [visit.visitorId])).get(
        visit.visitorId,
      ) ?? null;
    // The QR is the invite's entry pass; a walk-in is already at the desk.
    if (visit.referenceCode && visit.type !== 'WALK_IN') {
      detail.qrCode = await toDataURL(visit.referenceCode, {
        width: 240,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    }
    if (visit.checkInAt || visit.checkOutAt) {
      await this.attachOperativeNames(detail);
    }
    return detail;
  }

  private async attachOperativeNames(
    detail: VisitRequestDetail,
  ): Promise<void> {
    const events = await this.prisma.gateEvent.findMany({
      where: {
        visitId: detail.id,
        result: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
      },
      orderBy: { occurredAt: 'desc' },
      select: { result: true, operativeUserId: true },
    });
    const opIds = [
      ...new Set(
        events.map((e) => e.operativeUserId).filter((id): id is string => !!id),
      ),
    ];
    if (opIds.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: opIds } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    const inOp = events.find((e) => e.result === 'CHECKED_IN')?.operativeUserId;
    const outOp = events.find(
      (e) => e.result === 'CHECKED_OUT',
    )?.operativeUserId;
    detail.checkedInByName = inOp ? (nameById.get(inOp) ?? null) : null;
    detail.checkedOutByName = outOp ? (nameById.get(outOp) ?? null) : null;
  }

  async list(
    query: VisitListQuery,
    currentUserId: string,
    canReadAll = true,
  ): Promise<Paginated<VisitListItem>> {
    const where = buildListWhere(query, currentUserId, canReadAll);
    const orderBy = buildOrderBy(query);
    // A groupId fetch returns every member; otherwise each group collapses to one row.
    const collapse = !query.groupId;
    const { rows, total } = collapse
      ? await this.pageOfGroupRepresentatives(where, orderBy, query)
      : await this.pageOfVisits(where, orderBy, query);
    const groups = await this.summariseGroups(rows);
    return {
      items: await this.withHeldCards(toListItems(rows, collapse, groups)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  private async withHeldCards(
    items: VisitListItem[],
  ): Promise<VisitListItem[]> {
    const held = await heldRfidCards(
      this.prisma,
      items.map((i) => i.visitorId),
    );
    return items.map((i) => ({
      ...i,
      rfidCard: held.get(i.visitorId) ?? null,
    }));
  }

  private async pageOfGroupRepresentatives(
    where: Prisma.VisitWhereInput,
    orderBy: Prisma.VisitOrderByWithRelationInput,
    query: VisitListQuery,
  ): Promise<{ rows: VisitListRow[]; total: number }> {
    // Paginate over logical rows (one representative per group) so a page holding a group isn't short.
    const keys = await this.prisma.visit.findMany({
      where,
      select: { id: true, groupId: true, isGroupVisit: true },
      orderBy,
    });
    const repIds: string[] = [];
    const seen = new Set<string>();
    for (const k of keys) {
      if (k.isGroupVisit && k.groupId) {
        if (seen.has(k.groupId)) continue;
        seen.add(k.groupId);
      }
      repIds.push(k.id);
    }
    const total = repIds.length;
    const pageIds = repIds.slice(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize,
    );
    const pageRows = pageIds.length
      ? await this.prisma.visit.findMany({
          where: { id: { in: pageIds } },
          include: listInclude,
        })
      : [];
    const byId = new Map(pageRows.map((r) => [r.id, r]));
    // `in` doesn't preserve order.
    const rows = pageIds
      .map((id) => byId.get(id))
      .filter((r): r is VisitListRow => !!r);
    return { rows, total };
  }

  private async pageOfVisits(
    where: Prisma.VisitWhereInput,
    orderBy: Prisma.VisitOrderByWithRelationInput,
    query: VisitListQuery,
  ): Promise<{ rows: VisitListRow[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.visit.findMany({
        where,
        include: listInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.visit.count({ where }),
    ]);
    return { rows, total };
  }

  private async summariseGroups(rows: VisitListRow[]): Promise<GroupSummaries> {
    const groupIds = [
      ...new Set(
        rows
          .filter((r) => r.isGroupVisit)
          .map((r) => r.groupId)
          .filter((g): g is string => !!g),
      ),
    ];
    // Aggregate over all members (no status filter) so the derived status counts hidden PENDING guests.
    const groupAgg = groupIds.length
      ? await this.prisma.visit.groupBy({
          by: ['groupId', 'status'],
          where: { groupId: { in: groupIds } },
          _count: { _all: true },
        })
      : [];
    const sizeByGroup = new Map<string, number>();
    const statusesByGroup = new Map<string, Set<string>>();
    for (const g of groupAgg) {
      const id = g.groupId as string;
      // Denied/cancelled/expired guests aren't part of the visiting group.
      if (!GROUP_INACTIVE_STATUSES.has(g.status)) {
        sizeByGroup.set(id, (sizeByGroup.get(id) ?? 0) + g._count._all);
      }
      const set = statusesByGroup.get(id) ?? new Set<string>();
      set.add(g.status);
      statusesByGroup.set(id, set);
    }

    return { sizeByGroup, statusesByGroup };
  }
}

type GroupSummaries = {
  sizeByGroup: Map<string, number>;
  statusesByGroup: Map<string, Set<string>>;
};

function buildListWhere(
  query: VisitListQuery,
  currentUserId: string,
  canReadAll: boolean,
): Prisma.VisitWhereInput {
  const where: Prisma.VisitWhereInput = {};
  if (query.statuses?.length) where.status = { in: query.statuses };
  else if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.purpose) where.purpose = query.purpose;
  if (query.groupId) where.groupId = query.groupId;
  if (query.dateFrom || query.dateTo) {
    where[query.dateField] = {
      ...(query.dateFrom ? { gte: query.dateFrom } : {}),
      ...(query.dateTo ? { lte: query.dateTo } : {}),
    };
  }
  // Scope and search are both OR-groups; AND them so one doesn't clobber the other.
  const and: Prisma.VisitWhereInput[] = [];
  if (query.scope === 'mine' || !canReadAll) {
    // Includes requests I raised even when someone else hosts the guest.
    and.push({
      OR: [{ createdById: currentUserId }, { host: { userId: currentUserId } }],
    });
  }
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' } as const;
    const phone = phoneSearchDigits(query.search);
    and.push({
      OR: [
        { visitor: { fullName: contains } },
        { visitor: { email: contains } },
        { visitor: { organization: contains } },
        { host: { user: { fullName: contains } } },
        { floor: contains },
        { referenceCode: contains },
        ...(phone ? [{ visitor: { phone: { contains: phone } } }] : []),
      ],
    });
  }
  if (and.length) where.AND = and;
  return where;
}

function toListItems(
  rows: VisitListRow[],
  collapse: boolean,
  { sizeByGroup, statusesByGroup }: GroupSummaries,
): VisitListItem[] {
  const items: VisitListItem[] = [];
  const seenGroups = new Set<string>();
  for (const r of rows) {
    const isGroup = r.isGroupVisit && !!r.groupId;
    if (collapse && isGroup && seenGroups.has(r.groupId!)) continue;
    const size = isGroup ? (sizeByGroup.get(r.groupId!) ?? 1) : 1;
    const item = toListItem(r, size);
    if (collapse && isGroup) {
      seenGroups.add(r.groupId!);
      item.status = deriveGroupStatus(
        statusesByGroup.get(r.groupId!),
        item.status,
      );
    }
    items.push(item);
  }

  return items;
}
