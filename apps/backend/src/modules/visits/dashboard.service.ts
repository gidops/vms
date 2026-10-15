import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminOverviewStats,
  AdminStatsQuery,
  AdminTrafficPoint,
  AdminTrafficQuery,
} from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';

/** Individual visits are people; the paginated list collapses groups instead. */
@Injectable()
export class VisitDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(query: AdminStatsQuery): Promise<AdminOverviewStats> {
    const today = { gte: query.dateFrom, lte: query.dateTo };
    const yesterday = { gte: query.yesterdayFrom, lte: query.yesterdayTo };
    const visitors = (window: typeof today): Prisma.VisitWhereInput => ({
      status: { notIn: ['DENIED', 'CANCELLED', 'EXPIRED'] },
      // Includes unscheduled walk-ins who actually arrived on this day.
      OR: [{ scheduledAt: window }, { checkInAt: window }],
    });
    const countRequests = async (status: 'PENDING' | 'REVIEW_REQUESTED') => {
      const groups = await this.prisma.visit.groupBy({
        by: ['groupId', 'isGroupVisit'],
        where: { status },
        _count: { _all: true },
      });
      return groups.reduce(
        (sum, group) =>
          sum + (group.isGroupVisit && group.groupId ? 1 : group._count._all),
        0,
      );
    };
    const [
      visitorsToday,
      visitorsYesterday,
      expected,
      pending,
      reviewRequested,
      onsite,
      checkedOutToday,
      checkedInToday,
      deniedToday,
    ] = await Promise.all([
      this.prisma.visit.count({ where: visitors(today) }),
      this.prisma.visit.count({ where: visitors(yesterday) }),
      this.prisma.visit.count({
        where: { status: 'APPROVED', scheduledAt: today },
      }),
      countRequests('PENDING'),
      countRequests('REVIEW_REQUESTED'),
      this.prisma.visit.count({ where: { status: 'CHECKED_IN' } }),
      this.prisma.visit.count({
        where: { status: 'CHECKED_OUT', checkOutAt: today },
      }),
      this.prisma.visit.count({
        where: { status: 'CHECKED_IN', checkInAt: today },
      }),
      this.prisma.visit.count({
        where: { status: 'DENIED', scheduledAt: today },
      }),
    ]);
    return {
      visitorsToday,
      visitorsYesterday,
      expected,
      pending,
      reviewRequested,
      onsite,
      checkedOutToday,
      checkedInToday,
      deniedToday,
    };
  }

  async traffic(query: AdminTrafficQuery): Promise<AdminTrafficPoint[]> {
    // Read every individual arrival; no list pagination, group collapse, or
    // scheduledAt filter. Members arriving separately count in their own hour.
    const visits = await this.prisma.visit.findMany({
      where: { checkInAt: { gte: query.dateFrom, lte: query.dateTo } },
      select: { checkInAt: true },
    });
    const format = new Intl.DateTimeFormat('en', {
      timeZone: query.timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    });
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }));
    for (const visit of visits) {
      if (visit.checkInAt)
        hours[Number(format.format(visit.checkInAt))].value++;
    }
    return hours;
  }
}
