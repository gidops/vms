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

/**
 * Read side of the visits module: the single-visit detail view and the
 * paginated list that powers the admin approval queue, the VMC board, and the
 * staff "My Visits" screens. Every write service depends on this to build the
 * fresh detail it returns after committing.
 */
@Injectable()
export class VisitReadService {
  constructor(private readonly prisma: PrismaService) {}

  async getDetail(id: string): Promise<VisitRequestDetail> {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    const detail = toDetail(visit);
    if (visit.referenceCode) {
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

  /**
   * Resolve the "Checked In By" / "Checked Out By" operative names from the gate
   * log (the operativeUserId recorded at check-in / check-out).
   */
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

  /**
   * Paginated visit list. Ordering follows {@link buildOrderBy} (scheduled date
   * earliest-first by default; `sortBy: "createdAt"` for the staff/VMC boards).
   * The admin approval queue passes no scope; the staff dashboard passes
   * `scope: "mine"` to restrict the result to visits the requesting user hosts.
   * `type`/`purpose`, free-text `search`, and the `dateFrom`/`dateTo` window
   * (over `dateField`, default `scheduledAt`) are the staff facets.
   */
  async list(
    query: VisitListQuery,
    currentUserId: string,
  ): Promise<Paginated<VisitListItem>> {
    const where: Prisma.VisitWhereInput = {};
    if (query.statuses?.length) where.status = { in: query.statuses };
    else if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.purpose) where.purpose = query.purpose;
    if (query.groupId) where.groupId = query.groupId;
    if (query.dateFrom || query.dateTo) {
      // The window applies to whichever date column the caller asked for
      // (`scheduledAt` by default; the staff/VMC boards pass `createdAt`).
      where[query.dateField] = {
        ...(query.dateFrom ? { gte: query.dateFrom } : {}),
        ...(query.dateTo ? { lte: query.dateTo } : {}),
      };
    }
    // Scope and search are each an OR-group; they'd clobber one another as a
    // single top-level `where.OR`, so AND them together.
    const and: Prisma.VisitWhereInput[] = [];
    if (query.scope === 'mine') {
      // "Mine" = requests I created OR visits I host (a staff sees requests they
      // raised even when the guest is hosted by someone else).
      and.push({
        OR: [
          { createdById: currentUserId },
          { host: { userId: currentUserId } },
        ],
      });
    }
    if (query.search) {
      // Matches the staff search placeholder ("guest, host, floor, pass id").
      const contains = { contains: query.search, mode: 'insensitive' } as const;
      and.push({
        OR: [
          { visitor: { fullName: contains } },
          { visitor: { email: contains } },
          { visitor: { organization: contains } },
          { host: { user: { fullName: contains } } },
          { floor: contains },
          { referenceCode: contains },
        ],
      });
    }
    if (and.length) where.AND = and;
    const orderBy = buildOrderBy(query);
    // Fetching one group's members (the group check-in / approval sheets pass a
    // groupId) returns every guest as its own row; any other list collapses each
    // group visit to a single representative row.
    const collapse = !query.groupId;

    let rows: VisitListRow[];
    let total: number;
    if (collapse) {
      // A group visit is ONE logical row, so pagination must run over logical rows:
      // if we fetched a fixed-size page of raw rows and then collapsed group members,
      // a page holding a group would return fewer than pageSize rows. Read the
      // ordered ids once, keep one representative (the newest member) per group, then
      // fetch just this page's rows. `total`/`totalPages` are the logical-row count.
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
      total = repIds.length;
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
      // `in` doesn't preserve order — restore the ordered page order.
      rows = pageIds
        .map((id) => byId.get(id))
        .filter((r): r is VisitListRow => !!r);
    } else {
      [rows, total] = await this.prisma.$transaction([
        this.prisma.visit.findMany({
          where,
          include: listInclude,
          orderBy,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.visit.count({ where }),
      ]);
    }

    // Aggregate each group's size + member statuses across the whole filtered set
    // (not just this page) so the representative row shows the true guest count and
    // a derived status.
    const groupIds = [
      ...new Set(
        rows
          .filter((r) => r.isGroupVisit)
          .map((r) => r.groupId)
          .filter((g): g is string => !!g),
      ),
    ];
    // Aggregate over ALL of each group's members (no status filter) so the derived
    // status and guest count reflect the whole group — including still-PENDING
    // members that the board's status filter would otherwise hide.
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
      // Guest count = active members only (a denied/cancelled/expired guest is
      // not part of the visiting group).
      if (!GROUP_INACTIVE_STATUSES.has(g.status)) {
        sizeByGroup.set(id, (sizeByGroup.get(id) ?? 0) + g._count._all);
      }
      const set = statusesByGroup.get(id) ?? new Set<string>();
      set.add(g.status);
      statusesByGroup.set(id, set);
    }

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

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
