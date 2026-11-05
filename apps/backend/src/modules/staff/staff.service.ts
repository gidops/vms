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
import { watDayRange, watToday } from '../../shared/common/wat';

function dayBounds(ref: Date): { start: Date; end: Date } {
  const day = watToday(ref);
  const { gte, lt } = watDayRange(day, day);
  return { start: gte, end: lt };
}

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
    category: 'SM_FEEDBACK',
    title: 'From SM Desk',
    body: (n) => `A new remark was added to ${n}'s visit request.`,
  },
  'visit.flagged': {
    category: 'SECURITY_ALERT',
    title: 'Visit Flagged',
    body: (n) => `${n}'s visit was flagged and needs security review.`,
  },
  'visit.review_requested': {
    category: 'SM_FEEDBACK',
    title: 'More Information Requested',
    body: (n) =>
      `The Security Manager requested more information for ${n}'s visit.`,
  },
  // flag/request-info also emit `alert.created`; it is not mapped so each action yields one feed card.
  'alert.updated': {
    category: 'SECURITY_ALERT',
    title: 'Security Alert Updated',
    body: (n) => `${n}'s security alert was updated.`,
  },
};

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(userId: string): Promise<StaffDashboardStats> {
    // "Mine" = created OR hosted, so counts include requests raised for someone else's guest.
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

  /** Read from the append-only AuditLog for visits the staff created or hosts, plus their visitors' alerts. */
  async activityFeed(
    userId: string,
    query: StaffActivityQuery,
  ): Promise<Paginated<StaffActivityItem>> {
    const visitorMatch: Prisma.VisitorWhereInput | undefined = query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const visits = await this.prisma.visit.findMany({
      where: {
        OR: [{ createdById: userId }, { host: { userId } }],
        ...(visitorMatch ? { visitor: visitorMatch } : {}),
      },
      select: {
        id: true,
        visitorId: true,
        visitorNameAtVisit: true,
        visitor: { select: { fullName: true } },
      },
    });

    const visitName = new Map(
      visits.map((v) => [v.id, v.visitorNameAtVisit ?? v.visitor.fullName]),
    );
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
