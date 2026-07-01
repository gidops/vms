import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InboxItem, InboxQuery, Paginated } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';

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

/**
 * Unified "Requests & Alerts" feed. Reads visit requests and alerts, maps each
 * to an `InboxItem`, merges, sorts by recency, and paginates. The in-memory
 * merge is fine at current data scale; revisit (DB-level union) if it grows.
 */
@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: InboxQuery,
    currentUserId: string,
  ): Promise<Paginated<InboxItem>> {
    const wantRequests = query.kind === 'all' || query.kind === 'requests';
    const wantAlerts = query.kind === 'all' || query.kind === 'alerts';

    // `scope=mine` restricts to the signed-in host: their own visit requests, and
    // alerts raised against any visitor they host.
    const mine = query.scope === 'mine';
    const requestWhere: Prisma.VisitWhereInput = mine
      ? { host: { userId: currentUserId } }
      : {};
    const alertWhere: Prisma.AlertWhereInput = mine
      ? { visitor: { visits: { some: { host: { userId: currentUserId } } } } }
      : {};

    const [requests, alerts] = await Promise.all([
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
      ...requests.map((r) => this.toRequestItem(r)),
      ...alerts.map((a) => this.toAlertItem(a, raiserName)),
    ];

    const search = query.search?.trim().toLowerCase();
    if (search) {
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(search) ||
          i.description.toLowerCase().includes(search) ||
          (i.organization?.toLowerCase().includes(search) ?? false),
      );
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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

  private toRequestItem(r: RequestRow): InboxItem {
    const org = r.visitor.organization ?? null;
    return {
      kind: 'request',
      id: r.id,
      visitId: r.id,
      status: r.status,
      title: `Visit Request from ${r.host?.user.fullName ?? r.visitor.fullName}`,
      // Description ends at "from" so the frontend can emphasise the org.
      description: org
        ? `Visit request for ${r.visitor.fullName} from`
        : `Visit request for ${r.visitor.fullName}`,
      organization: org,
      createdByName: r.createdByName ?? r.createdBy?.fullName ?? null,
      notesCount: r._count.notes,
      createdAt: r.createdAt,
    };
  }

  private toAlertItem(a: AlertRow, raiserName: Map<string, string>): InboxItem {
    return {
      kind: 'alert',
      id: a.id,
      alertId: a.id,
      status: a.status,
      level: a.level,
      title: a.category ?? 'Flagged Visitor Match',
      description: a.reason,
      organization: a.visitor?.organization ?? null,
      createdByName: a.raisedById
        ? (raiserName.get(a.raisedById) ?? null)
        : null,
      notesCount: a._count.notes,
      createdAt: a.createdAt,
    };
  }
}
