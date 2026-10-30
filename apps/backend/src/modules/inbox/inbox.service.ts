import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  InboxItem,
  InboxQuery,
  InboxUnreadCount,
  Paginated,
} from '@vms/contracts';
import { AlertStatus, VisitStatus } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { identityAtVisit } from '../visits/helpers/visit-identity';

const requestInclude = Prisma.validator<Prisma.VisitInclude>()({
  visitor: true,
  host: { include: { user: true } },
  createdBy: true,
  _count: { select: { notes: true } },
});

type RequestRow = Prisma.VisitGetPayload<{ include: typeof requestInclude }>;

const alertInclude = Prisma.validator<Prisma.AlertInclude>()({
  visitor: true,
  _count: { select: { notes: true } },
});

type AlertRow = Prisma.AlertGetPayload<{ include: typeof alertInclude }>;

const cardInclude = Prisma.validator<Prisma.RfidCardAssignmentInclude>()({
  card: true,
  visitor: true,
});

type CardRow = Prisma.RfidCardAssignmentGetPayload<{
  include: typeof cardInclude;
}>;

/** Merges visit requests and alerts in memory (fine at current scale); `unread` derives from the user's `lastInboxSeenAt`. */
@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: InboxQuery,
    currentUserId: string,
    canReadAll = true,
  ): Promise<Paginated<InboxItem>> {
    const seenAt = await this.lastSeenAt(currentUserId);
    const items = await this.collect(query, currentUserId, seenAt, canReadAll);

    const total = items.length;
    const start = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async unreadCount(
    query: InboxQuery,
    currentUserId: string,
    canReadAll = true,
  ): Promise<InboxUnreadCount> {
    const seenAt = await this.lastSeenAt(currentUserId);
    const items = await this.collect(query, currentUserId, seenAt, canReadAll);
    return { unread: items.filter((i) => i.unread).length };
  }

  async markSeen(currentUserId: string): Promise<{ seenAt: Date }> {
    const seenAt = new Date();
    await this.prisma.user.update({
      where: { id: currentUserId },
      data: { lastInboxSeenAt: seenAt },
    });
    return { seenAt };
  }

  private async lastSeenAt(userId: string): Promise<Date> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastInboxSeenAt: true },
    });
    return user?.lastInboxSeenAt ?? new Date(0);
  }

  private async collect(
    query: InboxQuery,
    currentUserId: string,
    seenAt: Date,
    canReadAll: boolean,
  ): Promise<InboxItem[]> {
    // A status filter matches one side only (VisitStatus and AlertStatus share no
    // values), so it also disambiguates which kind the user is filtering.
    const visitStatus =
      query.status && VisitStatus.safeParse(query.status).success
        ? (query.status as VisitStatus)
        : undefined;
    const alertStatus =
      query.status && AlertStatus.safeParse(query.status).success
        ? (query.status as AlertStatus)
        : undefined;

    const requestOnly =
      query.type !== undefined ||
      query.purpose !== undefined ||
      visitStatus !== undefined;
    const alertOnly = alertStatus !== undefined;
    const wantRequests =
      !alertOnly && (query.kind === 'all' || query.kind === 'requests');
    const wantAlerts =
      !requestOnly && (query.kind === 'all' || query.kind === 'alerts');

    // Principals without `visit:read` (staff) are always limited to `scope=mine`.
    const mine = query.scope === 'mine' || !canReadAll;
    // Overdue cards are reception's job, so they never appear in a personal scope.
    const wantCards =
      !mine &&
      !requestOnly &&
      !alertOnly &&
      (query.kind === 'all' || query.kind === 'cards');
    const requestWhere: Prisma.VisitWhereInput = {
      ...(mine ? { host: { userId: currentUserId } } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.purpose ? { purpose: query.purpose } : {}),
      ...(visitStatus ? { status: visitStatus } : {}),
    };
    const alertWhere: Prisma.AlertWhereInput = {
      ...(mine
        ? { visitor: { visits: { some: { host: { userId: currentUserId } } } } }
        : {}),
      ...(alertStatus ? { status: alertStatus } : {}),
    };

    const [requests, alerts, cards] = await Promise.all([
      wantRequests
        ? this.prisma.visit.findMany({
            where: requestWhere,
            include: requestInclude,
          })
        : Promise.resolve([] as RequestRow[]),
      wantAlerts
        ? this.prisma.alert.findMany({
            where: alertWhere,
            include: alertInclude,
          })
        : Promise.resolve([] as AlertRow[]),
      wantCards
        ? this.prisma.rfidCardAssignment.findMany({
            where: { status: 'ACTIVE', validUntil: { lt: new Date() } },
            include: cardInclude,
          })
        : Promise.resolve([] as CardRow[]),
    ]);

    // Alerts store the raiser as a plain id; resolve names in one batch.
    const raiserIds = [
      ...new Set(
        alerts.map((a) => a.raisedById).filter((v): v is string => !!v),
      ),
    ];
    const raisers = raiserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: raiserIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const raiserName = new Map(raisers.map((u) => [u.id, u.fullName]));

    let items: InboxItem[] = [
      ...requests.map((r) => this.toRequestItem(r, seenAt)),
      ...alerts.map((a) => this.toAlertItem(a, raiserName, seenAt)),
      ...cards.map((c) => this.toCardItem(c, seenAt)),
    ];

    const search = query.search?.trim().toLowerCase();
    if (search) {
      items = items.filter((i) => this.matchesSearch(i, search));
    }

    items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return items;
  }

  private matchesSearch(item: InboxItem, search: string): boolean {
    const haystack =
      item.kind === 'request'
        ? [item.visitorName, item.hostName, item.organization, item.purpose]
        : item.kind === 'alert'
          ? [item.visitorName, item.category, item.reason, item.organization]
          : [item.visitorName, item.cardNumber, item.organization];
    return haystack.some((v) => v?.toLowerCase().includes(search));
  }

  private toRequestItem(r: RequestRow, seenAt: Date): InboxItem {
    return {
      kind: 'request',
      id: r.id,
      visitId: r.id,
      status: r.status,
      visitorName: identityAtVisit(r).fullName,
      hostName: r.host?.user.fullName ?? null,
      type: r.type,
      purpose: r.purpose,
      organization: identityAtVisit(r).organization ?? null,
      createdByName: r.createdByName ?? r.createdBy?.fullName ?? null,
      notesCount: r._count.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      unread: r.updatedAt > seenAt,
    };
  }

  private toAlertItem(
    a: AlertRow,
    raiserName: Map<string, string>,
    seenAt: Date,
  ): InboxItem {
    return {
      kind: 'alert',
      id: a.id,
      alertId: a.id,
      status: a.status,
      level: a.level,
      category: a.category ?? null,
      reason: a.reason,
      visitorName: a.visitor?.fullName ?? null,
      organization: a.visitor?.organization ?? null,
      createdByName: a.raisedById
        ? (raiserName.get(a.raisedById) ?? null)
        : null,
      notesCount: a._count.notes,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      unread: a.updatedAt > seenAt,
    };
  }

  /** Dated from when the card fell due, so it surfaces as new at that moment. */
  private toCardItem(c: CardRow, seenAt: Date): InboxItem {
    return {
      kind: 'card',
      id: c.id,
      assignmentId: c.id,
      cardNumber: c.card.cardNumber,
      validUntil: c.validUntil,
      visitorName: c.visitor.fullName,
      visitId: c.visitId,
      organization: c.visitor.organization ?? null,
      createdByName: null,
      notesCount: 0,
      createdAt: c.validUntil,
      updatedAt: c.validUntil,
      unread: c.validUntil > seenAt,
    };
  }
}
