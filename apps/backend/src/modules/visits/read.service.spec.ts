import type { VisitListQuery } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitReadService } from './read.service';

describe('VisitReadService.list scoping', () => {
  function setup() {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      visit: { findMany, count },
      $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    } as unknown as PrismaService;
    const service = new VisitReadService(prisma);
    return { service, findMany };
  }

  const query = (over: Partial<VisitListQuery>): VisitListQuery => ({
    page: 1,
    pageSize: 20,
    sortDir: 'desc',
    scope: 'all',
    dateField: 'scheduledAt',
    ...over,
  });

  it('scopes to visits the current user created OR hosts when scope=mine', async () => {
    const { service, findMany } = setup();
    await service.list(query({ scope: 'mine' }), 'me');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [{ createdById: 'me' }, { host: { userId: 'me' } }],
            },
          ],
        },
      }),
    );
  });

  it('does not host-scope the admin queue (scope=all)', async () => {
    const { service, findMany } = setup();
    await service.list(query({ status: 'PENDING' }), 'me');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } }),
    );
  });

  it('orders by scheduled date ascending (earliest first) with undated visits last', async () => {
    const { service, findMany } = setup();
    await service.list(query({ scope: 'all' }), 'me');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { scheduledAt: { sort: 'asc', nulls: 'last' } },
      }),
    );
  });

  it('orders by createdAt when sortBy=createdAt (staff dashboard)', async () => {
    const { service, findMany } = setup();
    await service.list(query({ sortBy: 'createdAt', sortDir: 'desc' }), 'me');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('windows the date range on the requested dateField (createdAt)', async () => {
    const { service, findMany } = setup();
    const from = new Date('2026-07-01T00:00:00.000Z');
    const to = new Date('2026-07-13T23:59:59.999Z');
    await service.list(
      query({ dateField: 'createdAt', dateFrom: from, dateTo: to }),
      'me',
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: from, lte: to } }),
      }),
    );
  });

  it('builds a case-insensitive OR search across guest/host/floor/pass id', async () => {
    const { service, findMany } = setup();
    await service.list(query({ search: 'jordan' }), 'me');
    const c = { contains: 'jordan', mode: 'insensitive' };
    // scope defaults to 'all' here, so the only AND member is the search group.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { visitor: { fullName: c } },
                { visitor: { email: c } },
                { visitor: { organization: c } },
                { host: { user: { fullName: c } } },
                { floor: c },
                { referenceCode: c },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('scope=mine AND search combine as two separate AND groups', async () => {
    const { service, findMany } = setup();
    await service.list(query({ scope: 'mine', search: 'jordan' }), 'me');
    const c = { contains: 'jordan', mode: 'insensitive' };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            { OR: [{ createdById: 'me' }, { host: { userId: 'me' } }] },
            {
              OR: [
                { visitor: { fullName: c } },
                { visitor: { email: c } },
                { visitor: { organization: c } },
                { host: { user: { fullName: c } } },
                { floor: c },
                { referenceCode: c },
              ],
            },
          ],
        }),
      }),
    );
  });
});

describe('VisitReadService.list statuses + groupSize', () => {
  const query = (over: Partial<VisitListQuery>): VisitListQuery => ({
    page: 1,
    pageSize: 20,
    sortDir: 'desc',
    scope: 'all',
    dateField: 'scheduledAt',
    ...over,
  });

  it('collapses a group to one representative row and leaves bulk/single rows alone', async () => {
    // a + b are one group visit (g1); c is an independent (bulk/single) visit.
    const rows = [
      {
        id: 'a',
        groupId: 'g1',
        isGroupVisit: true,
        status: 'APPROVED',
        visitor: {},
        host: null,
      },
      {
        id: 'b',
        groupId: 'g1',
        isGroupVisit: true,
        status: 'CHECKED_IN',
        visitor: {},
        host: null,
      },
      {
        id: 'c',
        groupId: null,
        isGroupVisit: false,
        status: 'APPROVED',
        visitor: {},
        host: null,
      },
    ];
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(3);
    // groupBy is now keyed by [groupId, status] over the group members.
    const groupBy = jest.fn().mockResolvedValue([
      { groupId: 'g1', status: 'APPROVED', _count: { _all: 1 } },
      { groupId: 'g1', status: 'CHECKED_IN', _count: { _all: 1 } },
    ]);
    const prisma = {
      visit: { findMany, count, groupBy },
      $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    } as unknown as PrismaService;
    const service = new VisitReadService(prisma);

    const result = await service.list(
      query({ statuses: ['APPROVED', 'CHECKED_IN'] }),
      'me',
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['APPROVED', 'CHECKED_IN'] } },
      }),
    );
    // a + b collapse into one row; c stays. Group size counts both members, and
    // the derived status is Expected (APPROVED) because member `a` (APPROVED) has
    // not checked in yet — even though `b` is CHECKED_IN.
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('a');
    expect(result.items[0].groupSize).toBe(2);
    expect(result.items[0].status).toBe('APPROVED');
    expect(result.items[1].id).toBe('c');
    expect(result.items[1].groupSize).toBe(1);
  });

  it.each([
    [['APPROVED', 'CHECKED_IN'], 'APPROVED'], // someone not checked in → Expected
    [['PENDING', 'CHECKED_IN'], 'APPROVED'], // pending member holds it Expected
    [['CHECKED_IN'], 'CHECKED_IN'], // all on-site → Onsite
    [['CHECKED_IN', 'CHECKED_OUT'], 'CHECKED_IN'], // all checked in, some left → Onsite
    [['CHECKED_OUT'], 'CHECKED_OUT'], // everyone left → Checked Out
    [['CANCELLED', 'CHECKED_IN'], 'CHECKED_IN'], // cancelled guest ignored → Onsite
  ])('derives a group status of %s → %s', async (memberStatuses, expected) => {
    const rows = [
      {
        id: 'a',
        groupId: 'g1',
        isGroupVisit: true,
        status: 'APPROVED',
        visitor: {},
        host: null,
      },
    ];
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(1);
    const groupBy = jest.fn().mockResolvedValue(
      memberStatuses.map((status) => ({
        groupId: 'g1',
        status,
        _count: { _all: 1 },
      })),
    );
    const prisma = {
      visit: { findMany, count, groupBy },
      $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    } as unknown as PrismaService;
    const service = new VisitReadService(prisma);

    const result = await service.list(
      query({ statuses: ['APPROVED', 'CHECKED_IN', 'CHECKED_OUT'] }),
      'me',
    );
    expect(result.items[0].status).toBe(expected);
  });

  it('paginates over collapsed rows so a group counts as one logical row', async () => {
    // Raw set (scheduled order): a + b are one group (g1); c, d are singles. The
    // logical rows are [g1-representative, c, d] → 3, so pageSize 2 = 2 pages and
    // page 1 must return a full 2 rows even though a group spans it.
    const rows = [
      {
        id: 'a',
        groupId: 'g1',
        isGroupVisit: true,
        status: 'APPROVED',
        visitor: {},
        host: null,
      },
      {
        id: 'b',
        groupId: 'g1',
        isGroupVisit: true,
        status: 'APPROVED',
        visitor: {},
        host: null,
      },
      {
        id: 'c',
        groupId: null,
        isGroupVisit: false,
        status: 'APPROVED',
        visitor: {},
        host: null,
      },
      {
        id: 'd',
        groupId: null,
        isGroupVisit: false,
        status: 'APPROVED',
        visitor: {},
        host: null,
      },
    ];
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn();
    const groupBy = jest
      .fn()
      .mockResolvedValue([
        { groupId: 'g1', status: 'APPROVED', _count: { _all: 2 } },
      ]);
    const prisma = {
      visit: { findMany, count, groupBy },
      $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    } as unknown as PrismaService;
    const service = new VisitReadService(prisma);

    const page1 = await service.list(query({ pageSize: 2, page: 1 }), 'me');
    // total / totalPages count logical (collapsed) rows, not raw visit rows.
    expect(page1.total).toBe(3);
    expect(page1.totalPages).toBe(2);
    expect(page1.items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(page1.items[0].groupSize).toBe(2);

    const page2 = await service.list(query({ pageSize: 2, page: 2 }), 'me');
    expect(page2.items.map((i) => i.id)).toEqual(['d']);

    // The collapsed path slices logical ids in memory — no offset row count query.
    expect(count).not.toHaveBeenCalled();
  });

  it('returns every group member (no collapse) when a groupId filter is set', async () => {
    const rows = [
      {
        id: 'a',
        groupId: 'g1',
        isGroupVisit: true,
        status: 'APPROVED',
        visitor: {},
        host: null,
      },
      {
        id: 'b',
        groupId: 'g1',
        isGroupVisit: true,
        status: 'APPROVED',
        visitor: {},
        host: null,
      },
    ];
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(2);
    const groupBy = jest
      .fn()
      .mockResolvedValue([
        { groupId: 'g1', status: 'APPROVED', _count: { _all: 2 } },
      ]);
    const prisma = {
      visit: { findMany, count, groupBy },
      $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    } as unknown as PrismaService;
    const service = new VisitReadService(prisma);

    const result = await service.list(query({ groupId: 'g1' }), 'me');

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('VisitReadService.getDetail', () => {
  it('resolves checked-in/out operative names from the gate log', async () => {
    const now = new Date();
    const visitRow = {
      id: 'v1',
      visitorId: 'vis1',
      hostId: null,
      invitationId: null,
      groupId: null,
      isGroupVisit: false,
      groupName: null,
      groupContact: null,
      referenceCode: null,
      type: 'PRE_INVITED',
      status: 'CHECKED_OUT',
      purpose: 'Meeting',
      floor: null,
      riskLevel: null,
      scheduledAt: null,
      gateValidatedAt: null,
      checkInAt: now,
      checkOutAt: now,
      createdAt: now,
      updatedAt: now,
      source: null,
      createdById: null,
      createdByName: 'Creator',
      createdBy: null,
      visitor: { id: 'vis1', fullName: 'Guest', email: 'g@x.io' },
      host: null,
      pass: null,
      notes: [],
    };
    const prisma = {
      visit: { findUnique: jest.fn().mockResolvedValue(visitRow) },
      gateEvent: {
        findMany: jest.fn().mockResolvedValue([
          { result: 'CHECKED_IN', operativeUserId: 'op1' },
          { result: 'CHECKED_OUT', operativeUserId: 'op2' },
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'op1', fullName: 'Alice' },
          { id: 'op2', fullName: 'Bob' },
        ]),
      },
    } as unknown as PrismaService;
    const service = new VisitReadService(prisma);

    const detail = await service.getDetail('v1');
    expect(detail.checkedInByName).toBe('Alice');
    expect(detail.checkedOutByName).toBe('Bob');
  });
});
