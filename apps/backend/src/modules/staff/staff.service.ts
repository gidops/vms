import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Paginated,
  StaffActivityCategory,
  StaffActivityItem,
  StaffActivityQuery,
  StaffDashboardStats,
} from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';

/** Inclusive start / exclusive end of the calendar day containing `ref`. */
function dayBounds(ref: Date): { start: Date; end: Date } {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Maps an audit event type → the feed card's category + copy. */
const ACTIVITY_MAP: Record<
  string,
  {
    category: StaffActivityCategory;
    title: string;
    body: (name: string) => string;
  }
> = {
  'visit.approved': {
    category: 'REQUEST_UPDATE',
    title: 'Request Approved',
    body: (n) => `${n}'s visit has been approved.`,
  },
  'visit.denied': {
    category: 'REQUEST_UPDATE',
    title: 'Request Denied',
    body: (n) => `${n}'s visit request was declined.`,
  },
  'visit.requested': {
    category: 'REQUEST_UPDATE',
    title: 'Request Submitted',
    body: (n) => `${n}'s visit request was submitted for approval.`,
  },
  'visit.updated': {
    category: 'REQUEST_UPDATE',
    title: 'Request Updated',
    body: (n) => `${n}'s visit request was updated.`,
  },
  'visit.cancelled': {
    category: 'REQUEST_UPDATE',
    title: 'Request Cancelled',
    body: (n) => `${n}'s visit request was cancelled.`,
  },
  'visitor.checked_in': {
    category: 'VISIT_STATUS',
    title: 'Visitor Check-in',
    body: (n) => `${n} has been checked in.`,
  },
  'visitor.checked_out': {
    category: 'VISIT_STATUS',
    title: 'Visitor Check-Out',
    body: (n) => `${n} is checked out.`,
  },
  'note.added': {
    category: 'CSO_FEEDBACK',
    title: 'From CSO Desk',
    body: (n) => `A new remark was added to ${n}'s visit request.`,
  },
  'visit.flagged': {
    category: 'SECURITY_ALERT',
    title: 'Visit Flagged',
    body: (n) => `${n}'s visit was flagged and needs security review.`,
  },
  'visit.review_requested': {
    category: 'CSO_FEEDBACK',
    title: 'More Information Requested',
    body: (n) => `The CSO requested more information for ${n}'s visit.`,
  },
  // Note: flag/request-info also emit `alert.created`; we map the visit-centric
  // events above (not alert.created) so each action yields a single feed card
  // with the right category.
  'alert.updated': {
    category: 'SECURITY_ALERT',
    title: 'Security Alert Updated',
    body: (n) => `${n}'s security alert was updated.`,
  },
};

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  /** Headline counts for the signed-in staff's "Today's Schedule". */
  async stats(userId: string): Promise<StaffDashboardStats> {
    // "Mine" = requests I created OR visits I host, so a staff's counts include
    // requests they raised even when the guest is hosted by someone else.
    const mineWhere: Prisma.VisitWhereInput = {
      OR: [{ createdById: userId }, { host: { userId } }],
    };
    const { start, end } = dayBounds(new Date());

    const [expectedToday, awaitingApproval, onsite] = await Promise.all([
      this.prisma.visit.count({
        where: {
          ...mineWhere,
          status: 'APPROVED',
          scheduledAt: { gte: start, lt: end },
        },
      }),
      this.prisma.visit.count({
        where: {
          ...mineWhere,
          status: { in: ['PENDING', 'REVIEW_REQUESTED'] },
        },
      }),
      this.prisma.visit.count({
        where: { ...mineWhere, status: 'CHECKED_IN' },
      }),
    ]);

    return { expectedToday, awaitingApproval, onsite };
  }

  /**
   * The staff's "Recent Updates" feed, read from the append-only AuditLog. Resolves
   * the staff's visits — those they created OR host — (+ their visitors' alerts)
   * and surfaces audit rows for those aggregates, newest first, mapped to
   * human-facing cards.
   */
  async activityFeed(
    userId: string,
    query: StaffActivityQuery,
  ): Promise<Paginated<StaffActivityItem>> {
    const visits = await this.prisma.visit.findMany({
      where: { OR: [{ createdById: userId }, { host: { userId } }] },
      select: {
        id: true,
        visitorId: true,
        visitor: { select: { fullName: true } },
      },
    });

    const visitName = new Map(visits.map((v) => [v.id, v.visitor.fullName]));
    const visitorIds = [...new Set(visits.map((v) => v.visitorId))];

    const alerts = visitorIds.length
      ? await this.prisma.alert.findMany({
          where: { visitorId: { in: visitorIds } },
          select: { id: true, visitor: { select: { fullName: true } } },
        })
      : [];
    const alertName = new Map(
      alerts.map((a) => [a.id, a.visitor?.fullName ?? 'A visitor']),
    );

    const visitIds = [...visitName.keys()];
    const alertIds = [...alertName.keys()];
    if (visitIds.length === 0 && alertIds.length === 0) {
      return this.emptyPage(query);
    }

    // Category filter narrows to the audit actions that map to that category.
    const actions = Object.entries(ACTIVITY_MAP)
      .filter(([, m]) => !query.category || m.category === query.category)
      .map(([action]) => action);

    const where: Prisma.AuditLogWhereInput = {
      action: { in: actions },
      OR: [
        { entityType: 'Visit', entityId: { in: visitIds } },
        { entityType: 'Alert', entityId: { in: alertIds } },
      ],
    };
    if (query.date) {
      const { start, end } = dayBounds(query.date);
      where.createdAt = { gte: start, lt: end };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items = rows.map((row): StaffActivityItem => {
      const meta = ACTIVITY_MAP[row.action];
      const isAlert = row.entityType === 'Alert';
      const name = isAlert
        ? (alertName.get(row.entityId ?? '') ?? 'A visitor')
        : (visitName.get(row.entityId ?? '') ?? 'A visitor');
      return {
        id: row.id,
        category: meta?.category ?? 'REQUEST_UPDATE',
        title: meta?.title ?? 'Update',
        body: meta ? meta.body(name) : '',
        subjectName: name,
        visitId: isAlert ? null : row.entityId,
        alertId: isAlert ? row.entityId : null,
        createdAt: row.createdAt,
      };
    });

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  private emptyPage(query: StaffActivityQuery): Paginated<StaffActivityItem> {
    return {
      items: [],
      page: query.page,
      pageSize: query.pageSize,
      total: 0,
      totalPages: 1,
    };
  }
}
