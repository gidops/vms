import { AdminStatsQuery, AdminTrafficQuery } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitDashboardService } from './dashboard.service';

const dateFrom = new Date('2026-10-14T23:00:00Z');
const dateTo = new Date('2026-10-15T22:59:59.999Z');
const query = { dateFrom, dateTo, timeZone: 'Africa/Lagos' };

describe('VisitDashboardService', () => {
  it('counts each arrival, including more than one list page and separate group arrivals', async () => {
    // These represent separate visitors even if they share a group. One visitor
    // arrived before the old 08:00 chart cutoff; the last arrived after 17:00.
    const arrivals = [
      ...Array.from({ length: 101 }, () => ({
        checkInAt: new Date('2026-10-15T06:30:00Z'),
      })),
      { checkInAt: new Date('2026-10-15T09:00:00Z') },
      { checkInAt: new Date('2026-10-15T20:00:00Z') },
    ];
    const findMany = jest.fn().mockResolvedValue(arrivals);
    const prisma = { visit: { findMany } } as unknown as PrismaService;
    const result = await new VisitDashboardService(prisma).traffic(query);
    expect(result).toHaveLength(24);
    expect(result[7].value).toBe(101);
    expect(result[10].value).toBe(1);
    expect(result[21].value).toBe(1);
    expect(result.reduce((sum, point) => sum + point.value, 0)).toBe(103);
    expect(findMany).toHaveBeenCalledWith({
      where: { checkInAt: { gte: dateFrom, lte: dateTo } },
      select: { checkInAt: true },
    });
  });

  it('places arrivals in the requested time zone across a daylight-saving boundary', async () => {
    const prisma = {
      visit: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { checkInAt: new Date('2026-11-01T05:30:00Z') },
            { checkInAt: new Date('2026-11-01T06:30:00Z') },
          ]),
      },
    } as unknown as PrismaService;
    const result = await new VisitDashboardService(prisma).traffic({
      dateFrom: new Date('2026-11-01T04:00:00Z'),
      dateTo: new Date('2026-11-02T04:59:59.999Z'),
      timeZone: 'America/New_York',
    });
    expect(result[1].value).toBe(2);
  });

  it('counts people directly but collapses pending group requests, including null group IDs', async () => {
    const count = jest.fn().mockResolvedValue(3);
    const groupBy = jest.fn().mockResolvedValue([
      { groupId: 'g1', isGroupVisit: true, _count: { _all: 3 } },
      { groupId: null, isGroupVisit: false, _count: { _all: 2 } },
      { groupId: null, isGroupVisit: true, _count: { _all: 1 } },
    ]);
    const prisma = { visit: { count, groupBy } } as unknown as PrismaService;
    const result = await new VisitDashboardService(prisma).stats({
      dateFrom,
      dateTo,
      yesterdayFrom: new Date('2026-10-13T23:00:00Z'),
      yesterdayTo: new Date('2026-10-14T22:59:59.999Z'),
    });
    expect(result.visitorsToday).toBe(3);
    expect(result.onsite).toBe(3);
    expect(result.pending).toBe(4);
    expect(result.reviewRequested).toBe(4);
    expect(count).toHaveBeenCalledWith({ where: { status: 'CHECKED_IN' } });
    expect(count).toHaveBeenCalledWith({
      where: {
        status: 'CHECKED_OUT',
        checkOutAt: { gte: dateFrom, lte: dateTo },
      },
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        status: { notIn: ['DENIED', 'CANCELLED', 'EXPIRED'] },
        OR: [
          { scheduledAt: { gte: dateFrom, lte: dateTo } },
          { checkInAt: { gte: dateFrom, lte: dateTo } },
        ],
      },
    });
  });

  it('rejects invalid zones, reversed bounds and oversized windows before queries run', () => {
    expect(
      AdminTrafficQuery.safeParse({ ...query, timeZone: 'invalid-zone' })
        .success,
    ).toBe(false);
    expect(
      AdminTrafficQuery.safeParse({
        ...query,
        dateTo: dateFrom,
        dateFrom: dateTo,
      }).success,
    ).toBe(false);
    expect(
      AdminTrafficQuery.safeParse({ ...query, dateTo: '2026-11-01T00:00:00Z' })
        .success,
    ).toBe(false);
    expect(
      AdminStatsQuery.safeParse({
        ...query,
        yesterdayFrom: dateTo,
        yesterdayTo: dateFrom,
      }).success,
    ).toBe(false);
    expect(
      AdminTrafficQuery.safeParse({
        dateFrom: '2026-11-01T04:00:00Z',
        dateTo: '2026-11-02T04:59:59.999Z',
        timeZone: 'America/New_York',
      }).success,
    ).toBe(true);
  });
});
