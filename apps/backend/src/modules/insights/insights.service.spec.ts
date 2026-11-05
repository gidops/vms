import { NotFoundException } from '@nestjs/common';
import { InsightsService } from './insights.service';

// 2026-10-24 12:00 WAT (Saturday).
const NOW = new Date('2026-10-24T11:00:00Z');
const at = (iso: string) => new Date(iso);

const visit = (over: Record<string, unknown> = {}) => ({
  status: 'CHECKED_OUT',
  type: 'PRE_INVITED',
  visitorId: 'p1',
  scheduledAt: at('2026-10-23T09:00:00Z'),
  checkInAt: at('2026-10-23T09:10:00Z'),
  checkOutAt: at('2026-10-23T10:10:00Z'),
  visitor: { fullName: 'Ada', organization: 'GTB' },
  host: { user: { fullName: 'Dr Alabi' } },
  ...over,
});

describe('InsightsService', () => {
  let prisma: any;
  let dashboard: { stats: jest.Mock };
  let svc: InsightsService;

  beforeEach(() => {
    prisma = {
      visit: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn(),
      },
      visitor: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      commsConsentEvent: { findMany: jest.fn().mockResolvedValue([]) },
      alert: { count: jest.fn().mockResolvedValue(0) },
    };
    dashboard = { stats: jest.fn().mockResolvedValue({}) };
    svc = new InsightsService(prisma, dashboard as never);
  });

  it('scopes self reads to visits the caller created or hosts', () => {
    expect(svc.scopeWhere('self', 'u1')).toEqual({
      OR: [{ createdById: 'u1' }, { host: { userId: 'u1' } }],
    });
    expect(svc.scopeWhere('facility', 'u1')).toEqual({});
  });

  it('asks the dashboard for WAT today and yesterday', async () => {
    await svc.overview(NOW);
    expect(dashboard.stats).toHaveBeenCalledWith({
      dateFrom: at('2026-10-23T23:00:00.000Z'),
      dateTo: at('2026-10-24T22:59:59.999Z'),
      yesterdayFrom: at('2026-10-22T23:00:00.000Z'),
      yesterdayTo: at('2026-10-23T22:59:59.999Z'),
    });
  });

  describe('visitors', () => {
    it('lists visitors with their scoped counts and latest consent', async () => {
      prisma.visit.groupBy.mockResolvedValue([
        {
          visitorId: 'p1',
          _count: { _all: 3 },
          _min: { scheduledAt: at('2026-01-01T09:00:00Z') },
          _max: { scheduledAt: at('2026-10-01T09:00:00Z') },
        },
      ]);
      prisma.visitor.count.mockResolvedValue(1);
      prisma.visitor.findMany.mockResolvedValue([
        { id: 'p1', fullName: 'Ada', email: 'Ada@X.com', organization: null },
      ]);
      prisma.commsConsentEvent.findMany.mockResolvedValue([
        { email: 'ada@x.com', consent: false },
        { email: 'ada@x.com', consent: true },
      ]);

      const res = await svc.visitors(
        { page: 1, pageSize: 20, sortDir: 'desc', search: 'ada' },
        'self',
        'u1',
      );

      expect(res.total).toBe(1);
      expect(res.items[0]).toMatchObject({
        id: 'p1',
        visitCount: 3,
        commsOptIn: false,
      });
      const where = prisma.visit.groupBy.mock.calls[0][0].where;
      expect(where.AND[0]).toEqual(svc.scopeWhere('self', 'u1'));
      expect(where.AND[1].visitor.OR).toHaveLength(3);
    });
  });

  describe('visitor', () => {
    it('hides a visitor the caller never hosted', async () => {
      prisma.visitor.findUnique.mockResolvedValue({ id: 'p1', email: 'a@b.c' });
      prisma.visit.aggregate.mockResolvedValue({
        _count: { _all: 0 },
        _min: { scheduledAt: null },
        _max: { scheduledAt: null },
      });
      await expect(svc.visitor('p1', 'self', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns the visitor's visits and average stay", async () => {
      prisma.visitor.findUnique.mockResolvedValue({
        id: 'p1',
        fullName: 'Ada',
        email: 'a@b.c',
        phone: null,
        organization: null,
      });
      prisma.visit.findMany.mockResolvedValue([
        {
          id: 'v1',
          ...visit(),
          purpose: 'Meeting',
          floor: '4th Floor',
        },
      ]);
      prisma.visit.aggregate.mockResolvedValue({
        _count: { _all: 1 },
        _min: { scheduledAt: at('2026-10-23T09:00:00Z') },
        _max: { scheduledAt: at('2026-10-23T09:00:00Z') },
      });
      const res = await svc.visitor('p1', 'facility', 'u1');
      expect(res.avgDurationMinutes).toBe(60);
      expect(res.visits[0].hostName).toBe('Dr Alabi');
      expect(res.commsOptIn).toBeNull();
    });
  });

  describe('analytics', () => {
    it('buckets visits by WAT day, week and hour', async () => {
      prisma.visit.findMany.mockResolvedValue([
        visit(),
        // 23:30 UTC on the 22nd is 00:30 WAT on the 23rd.
        visit({
          visitorId: 'p2',
          scheduledAt: at('2026-10-22T23:30:00Z'),
          checkInAt: null,
          checkOutAt: null,
          status: 'APPROVED',
        }),
        visit({ status: 'DENIED', visitorId: 'p3', checkInAt: null }),
        // Outside the 7-day window but inside the 12-week series.
        visit({ scheduledAt: at('2026-09-01T09:00:00Z') }),
      ]);
      prisma.visit.count.mockResolvedValueOnce(2).mockResolvedValueOnce(9);

      const res = await svc.analytics(
        { range: '7d' },
        'facility',
        'u1',
        false,
        NOW,
      );

      expect(res.daily).toHaveLength(7);
      expect(res.daily.at(-1)).toEqual({ date: '2026-10-24', count: 0 });
      expect(res.daily.find((d) => d.date === '2026-10-23')!.count).toBe(2);
      expect(res.totals).toMatchObject({
        visits: 2,
        uniqueVisitors: 2,
        arrived: 1,
        denied: 1,
        noShows: 1,
        upcoming: 2,
        allTimeVisits: 9,
        avgDurationMinutes: 60,
      });
      expect(res.weekly).toHaveLength(12);
      expect(res.weekly.at(-1)).toEqual({ weekStart: '2026-10-19', count: 2 });
      expect(res.weekly.reduce((a, w) => a + w.count, 0)).toBe(3);
      // 09:10 UTC check-in = 10:00 WAT.
      expect(res.hourly[10].count).toBe(1);
      expect(res.topHosts[0]).toEqual({ key: 'Dr Alabi', count: 2 });
      expect(res.security).toBeNull();
    });

    it('leaves facility-only breakdowns empty for self scope', async () => {
      prisma.visit.findMany.mockResolvedValue([visit()]);
      const res = await svc.analytics(
        { range: '30d' },
        'self',
        'u1',
        false,
        NOW,
      );
      expect(res.scope).toBe('self');
      expect(res.daily).toHaveLength(30);
      expect(res.topHosts).toEqual([]);
      expect(res.onsiteByFloor).toEqual([]);
      expect(prisma.visit.groupBy).not.toHaveBeenCalled();
    });

    it('adds security trends when asked', async () => {
      prisma.visit.findMany.mockResolvedValue([
        visit({ status: 'DENIED', checkInAt: null }),
      ]);
      prisma.alert.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(2);
      prisma.visit.groupBy.mockResolvedValue([
        { floor: '4th Floor', _count: { _all: 3 } },
        { floor: null, _count: { _all: 1 } },
      ]);
      const res = await svc.analytics(
        { range: '7d' },
        'facility',
        'u1',
        true,
        NOW,
      );
      expect(res.security).toMatchObject({
        flagged: 1,
        alertsRaised: 4,
        alertsOpen: 2,
      });
      expect(
        res.security!.deniedDaily.find((d) => d.date === '2026-10-23')!.count,
      ).toBe(1);
      expect(res.onsiteByFloor).toEqual([
        { key: '4th Floor', count: 3 },
        { key: '—', count: 1 },
      ]);
    });
  });
});
