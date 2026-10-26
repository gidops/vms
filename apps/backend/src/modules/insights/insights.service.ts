import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type VisitStatus } from '@prisma/client';
import {
  INSIGHTS_RANGE_DAYS,
  normalizeConsentEmail,
  type AdminOverviewStats,
  type InsightsAnalytics,
  type InsightsAnalyticsQuery,
  type InsightsCount,
  type InsightsScope,
  type InsightsVisitorDetail,
  type InsightsVisitorItem,
  type InsightsVisitorsQuery,
  type Paginated,
} from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { formatWat, watDayRange, watToday } from '../../shared/common/wat';
import { VisitDashboardService } from '../visits/dashboard.service';
import { phoneSearchDigits } from '../visits/read.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Visits that never happened; left out of volumes and visitor counts. */
const INACTIVE: VisitStatus[] = ['DENIED', 'CANCELLED', 'EXPIRED'];
const WEEKS = 12;
const TOP_N = 5;
/** Most visits shown in one visitor's history sheet. */
const VISITOR_HISTORY_LIMIT = 100;

/** `YYYY-MM-DD` plus `n` calendar days. */
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** The Monday on or before a `YYYY-MM-DD` day. */
function mondayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}

const watDay = (d: Date) => formatWat(d).slice(0, 10);
const watHour = (d: Date) => Number(formatWat(d).slice(11, 13));

/** Count by key, most frequent first (ties by key), keeping the top `n`. */
function top(keys: (string | null | undefined)[], n = TOP_N): InsightsCount[] {
  return tally(keys).slice(0, n);
}

function tally(keys: (string | null | undefined)[]): InsightsCount[] {
  const counts = new Map<string, number>();
  for (const k of keys) if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function avgMinutes(
  visits: { checkInAt: Date | null; checkOutAt: Date | null }[],
): number | null {
  const spans = visits
    .filter((v) => v.checkInAt && v.checkOutAt)
    .map((v) => v.checkOutAt!.getTime() - v.checkInAt!.getTime())
    .filter((ms) => ms >= 0);
  if (spans.length === 0) return null;
  return Math.round(spans.reduce((a, b) => a + b, 0) / spans.length / 60_000);
}

/**
 * Insights page: today's overview, the visitor directory and analytics. Each
 * read runs in the caller's scope: `facility` (everyone) or `self` (visits the
 * caller created or hosts — the same "mine" rule as the visit list). Counts are
 * per visit (one per guest); WAT calendar days throughout.
 */
@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: VisitDashboardService,
  ) {}

  scopeWhere(scope: InsightsScope, userId: string): Prisma.VisitWhereInput {
    return scope === 'self'
      ? { OR: [{ createdById: userId }, { host: { userId } }] }
      : {};
  }

  /** Today's facility-wide numbers (WAT today vs yesterday). */
  overview(now: Date = new Date()): Promise<AdminOverviewStats> {
    const today = watToday(now);
    const yesterday = addDays(today, -1);
    const t = watDayRange(today, today);
    const y = watDayRange(yesterday, yesterday);
    const last = (lt: Date) => new Date(lt.getTime() - 1);
    return this.dashboard.stats({
      dateFrom: t.gte,
      dateTo: last(t.lt),
      yesterdayFrom: y.gte,
      yesterdayTo: last(y.lt),
    });
  }

  /** Everyone who visited (in scope), most recent visit first. */
  async visitors(
    query: InsightsVisitorsQuery,
    scope: InsightsScope,
    userId: string,
  ): Promise<Paginated<InsightsVisitorItem>> {
    const and: Prisma.VisitWhereInput[] = [this.scopeWhere(scope, userId)];
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' } as const;
      const phone = phoneSearchDigits(query.search);
      and.push({
        visitor: {
          OR: [
            { fullName: contains },
            { email: contains },
            { organization: contains },
            ...(phone ? [{ phone: { contains: phone } }] : []),
          ],
        },
      });
    }
    const where: Prisma.VisitWhereInput = { AND: and };
    const [groups, total] = await Promise.all([
      this.prisma.visit.groupBy({
        by: ['visitorId'],
        where,
        _count: { _all: true },
        _min: { scheduledAt: true },
        _max: { scheduledAt: true },
        orderBy: [{ _max: { scheduledAt: 'desc' } }, { visitorId: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.visitor.count({ where: { visits: { some: where } } }),
    ]);
    const people = await this.prisma.visitor.findMany({
      where: { id: { in: groups.map((g) => g.visitorId) } },
      select: { id: true, fullName: true, email: true, organization: true },
    });
    const byId = new Map(people.map((p) => [p.id, p]));
    const consent = await this.latestConsent(people.map((p) => p.email));
    const items = groups.flatMap((g) => {
      const p = byId.get(g.visitorId);
      if (!p) return [];
      return [
        {
          ...p,
          visitCount: g._count._all,
          firstVisitAt: g._min.scheduledAt,
          lastVisitAt: g._max.scheduledAt,
          commsOptIn: consent.get(normalizeConsentEmail(p.email)) ?? null,
        },
      ];
    });
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  /** One visitor's visits (in scope). Out of scope reads as not found. */
  async visitor(
    id: string,
    scope: InsightsScope,
    userId: string,
  ): Promise<InsightsVisitorDetail> {
    const person = await this.prisma.visitor.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        organization: true,
      },
    });
    const where: Prisma.VisitWhereInput = {
      AND: [{ visitorId: id }, this.scopeWhere(scope, userId)],
    };
    const [visits, agg] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
        take: VISITOR_HISTORY_LIMIT,
        select: {
          id: true,
          status: true,
          type: true,
          purpose: true,
          floor: true,
          scheduledAt: true,
          checkInAt: true,
          checkOutAt: true,
          host: { select: { user: { select: { fullName: true } } } },
        },
      }),
      this.prisma.visit.aggregate({
        where,
        _count: { _all: true },
        _min: { scheduledAt: true },
        _max: { scheduledAt: true },
      }),
    ]);
    if (!person || agg._count._all === 0) {
      throw new NotFoundException('errors.visitor.notFound');
    }
    const consent = await this.latestConsent([person.email]);
    return {
      ...person,
      visitCount: agg._count._all,
      firstVisitAt: agg._min.scheduledAt,
      lastVisitAt: agg._max.scheduledAt,
      commsOptIn: consent.get(normalizeConsentEmail(person.email)) ?? null,
      avgDurationMinutes: avgMinutes(visits),
      visits: visits.map(({ host, ...v }) => ({
        ...v,
        hostName: host?.user.fullName ?? null,
      })),
    };
  }

  /** Latest consent answer per normalised email ("latest answer wins"). */
  private async latestConsent(emails: string[]): Promise<Map<string, boolean>> {
    const keys = [...new Set(emails.map(normalizeConsentEmail))];
    if (keys.length === 0) return new Map();
    const rows = await this.prisma.commsConsentEvent.findMany({
      where: { email: { in: keys } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { email: true, consent: true },
    });
    const out = new Map<string, boolean>();
    for (const r of rows) if (!out.has(r.email)) out.set(r.email, r.consent);
    return out;
  }

  async analytics(
    query: InsightsAnalyticsQuery,
    scope: InsightsScope,
    userId: string,
    includeSecurity: boolean,
    now: Date = new Date(),
  ): Promise<InsightsAnalytics> {
    const today = watToday(now);
    const days = INSIGHTS_RANGE_DAYS[query.range];
    const from = addDays(today, -(days - 1));
    const window = watDayRange(from, today);
    const firstWeek = addDays(mondayOf(today), -7 * (WEEKS - 1));
    const fetchFrom = firstWeek < from ? firstWeek : from;
    const todayStart = watDayRange(today, today).gte;
    const scoped = this.scopeWhere(scope, userId);

    const [rows, upcoming, allTimeVisits, onsite, security] = await Promise.all(
      [
        this.prisma.visit.findMany({
          where: {
            AND: [scoped, { scheduledAt: watDayRange(fetchFrom, today) }],
          },
          select: {
            status: true,
            type: true,
            visitorId: true,
            scheduledAt: true,
            checkInAt: true,
            checkOutAt: true,
            visitor: { select: { fullName: true, organization: true } },
            host: { select: { user: { select: { fullName: true } } } },
          },
        }),
        this.prisma.visit.count({
          where: {
            AND: [
              scoped,
              { status: { in: ['APPROVED', 'PENDING', 'REVIEW_REQUESTED'] } },
              { scheduledAt: { gte: todayStart } },
            ],
          },
        }),
        this.prisma.visit.count({
          where: { AND: [scoped, { status: { notIn: INACTIVE } }] },
        }),
        scope === 'facility' ? this.onsiteByFloor() : Promise.resolve([]),
        includeSecurity ? this.security(window) : Promise.resolve(null),
      ],
    );

    const inWindow = rows.filter(
      (v) => v.scheduledAt! >= window.gte && v.scheduledAt! < window.lt,
    );
    const active = inWindow.filter((v) => !INACTIVE.includes(v.status));
    const daily = Array.from({ length: days }, (_, i) => addDays(from, i));
    const perDay = new Map(daily.map((d) => [d, 0]));
    for (const v of active) {
      const d = watDay(v.scheduledAt!);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    const weeks = Array.from({ length: WEEKS }, (_, i) =>
      addDays(firstWeek, 7 * i),
    );
    const perWeek = new Map(weeks.map((w) => [w, 0]));
    for (const v of rows) {
      if (INACTIVE.includes(v.status)) continue;
      const w = mondayOf(watDay(v.scheduledAt!));
      if (perWeek.has(w)) perWeek.set(w, perWeek.get(w)! + 1);
    }
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
    }));
    for (const v of inWindow) {
      if (v.checkInAt) hourly[watHour(v.checkInAt)].count++;
    }
    const deniedDaily = new Map(daily.map((d) => [d, 0]));
    for (const v of inWindow) {
      if (v.status !== 'DENIED') continue;
      const d = watDay(v.scheduledAt!);
      deniedDaily.set(d, (deniedDaily.get(d) ?? 0) + 1);
    }

    return {
      scope,
      range: query.range,
      totals: {
        visits: active.length,
        uniqueVisitors: new Set(active.map((v) => v.visitorId)).size,
        arrived: inWindow.filter((v) => v.checkInAt).length,
        denied: inWindow.filter((v) => v.status === 'DENIED').length,
        cancelled: inWindow.filter((v) => v.status === 'CANCELLED').length,
        noShows: inWindow.filter(
          (v) =>
            v.status === 'EXPIRED' ||
            (v.status === 'APPROVED' && v.scheduledAt! < todayStart),
        ).length,
        upcoming,
        avgDurationMinutes: avgMinutes(inWindow),
        allTimeVisits,
      },
      daily: daily.map((date) => ({ date, count: perDay.get(date)! })),
      weekly: weeks.map((weekStart) => ({
        weekStart,
        count: perWeek.get(weekStart)!,
      })),
      hourly,
      byStatus: tally(inWindow.map((v) => v.status)),
      byType: tally(inWindow.map((v) => v.type)),
      topHosts:
        scope === 'facility'
          ? top(active.map((v) => v.host?.user.fullName))
          : [],
      topOrganizations: top(active.map((v) => v.visitor.organization)),
      topVisitors: top(active.map((v) => v.visitor.fullName)).filter(
        (t) => t.count > 1,
      ),
      onsiteByFloor: onsite,
      security: security
        ? {
            ...security,
            deniedDaily: daily.map((date) => ({
              date,
              count: deniedDaily.get(date)!,
            })),
          }
        : null,
    };
  }

  /** Who is checked in right now, by floor (busiest first). */
  private async onsiteByFloor(): Promise<InsightsCount[]> {
    const groups = await this.prisma.visit.groupBy({
      by: ['floor'],
      where: { status: 'CHECKED_IN' },
      _count: { _all: true },
    });
    return groups
      .map((g) => ({ key: g.floor ?? '—', count: g._count._all }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }

  /** Alert counts for the Security Manager / System Admin view. */
  private async security(window: { gte: Date; lt: Date }) {
    const [flagged, alertsRaised, alertsOpen] = await Promise.all([
      this.prisma.alert.count({
        where: { type: 'SECURITY_REVIEW', createdAt: window },
      }),
      this.prisma.alert.count({ where: { createdAt: window } }),
      this.prisma.alert.count({
        where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      }),
    ]);
    return { flagged, alertsRaised, alertsOpen };
  }
}
