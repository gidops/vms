import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CreateVisitsInput, VisitListQuery } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { VisitsService } from './visits.service';

describe('VisitsService lifecycle', () => {
  function setup(
    visit: Record<string, unknown> = {
      id: 'v1',
      status: 'APPROVED',
      scheduledAt: new Date(),
    },
    card: Record<string, unknown> | null = {
      id: 'card1',
      isActive: true,
      passId: null,
    },
  ) {
    const tx = {
      visit: { update: jest.fn().mockResolvedValue({}) },
      pass: {
        upsert: jest.fn().mockResolvedValue({ id: 'pass1' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          id: 'pass1',
          accessCard: { id: 'card1', assignedAt: new Date() },
        }),
      },
      accessCard: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      gateEvent: { create: jest.fn().mockResolvedValue({}) },
      alert: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    };
    const prisma = {
      visit: {
        findUnique: jest.fn().mockResolvedValue(visit),
        count: jest.fn().mockResolvedValue(1),
      },
      accessCard: { findUnique: jest.fn().mockResolvedValue(card) },
      // No open security hold by default; the security-hold test overrides this.
      alert: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new VisitsService(prisma, txm, events);
    jest.spyOn(service, 'getDetail').mockResolvedValue({ id: 'v1' } as never);
    return { service, tx, publish };
  }

  it('approve transitions to APPROVED without minting a pass', async () => {
    const { service, tx, publish } = setup();
    await service.approve('v1', 'actor');
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
    expect(tx.pass.upsert).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitApproved }),
    );
  });

  it('checkIn assigns the badge, activates the pass, and emits VisitorCheckedIn', async () => {
    const { service, tx, publish } = setup();
    await service.checkIn('v1', { accessCardId: 'card1' }, 'actor');
    expect(tx.pass.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(tx.accessCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'card1' },
        data: expect.objectContaining({ passId: 'pass1' }),
      }),
    );
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CHECKED_IN' }),
      }),
    );
    expect(tx.gateEvent.create).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitorCheckedIn }),
    );
  });

  it('checkIn rejects a visit that is not APPROVED', async () => {
    const { service } = setup({
      id: 'v1',
      status: 'PENDING',
      scheduledAt: null,
    });
    await expect(
      service.checkIn('v1', { accessCardId: 'card1' }, 'actor'),
    ).rejects.toThrow(BadRequestException);
  });

  it('checkIn rejects an unavailable badge', async () => {
    const { service } = setup(undefined, {
      id: 'card1',
      isActive: true,
      passId: 'other',
    });
    await expect(
      service.checkIn('v1', { accessCardId: 'card1' }, 'actor'),
    ).rejects.toThrow(BadRequestException);
  });

  it('checkIn rejects an approved visit that has an open security alert', async () => {
    const { service } = setup();
    (
      service as unknown as {
        prisma: { alert: { findFirst: jest.Mock } };
      }
    ).prisma.alert.findFirst.mockResolvedValueOnce({ id: 'a1' });
    await expect(
      service.checkIn('v1', { accessCardId: 'card1' }, 'actor'),
    ).rejects.toThrow(BadRequestException);
  });

  it('flag moves the visit to FLAGGED and raises a SECURITY_REVIEW alert', async () => {
    const { service, tx, publish } = setup({
      id: 'v1',
      status: 'APPROVED',
      visitorId: 'vis1',
    });
    await service.flag(
      'v1',
      { level: 'HIGH', reason: 'Threat identified' },
      'actor',
    );
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FLAGGED' }),
      }),
    );
    expect(tx.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SECURITY_REVIEW',
          level: 'HIGH',
          status: 'OPEN',
          raisedById: 'actor',
        }),
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitFlagged }),
    );
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.AlertCreated }),
    );
  });

  it('flag rejects a terminal visit', async () => {
    const { service } = setup({
      id: 'v1',
      status: 'CHECKED_OUT',
      visitorId: 'vis1',
    });
    await expect(
      service.flag('v1', { level: 'HIGH', reason: 'x' }, 'actor'),
    ).rejects.toThrow(BadRequestException);
  });

  it('requestInfo moves the visit to REVIEW_REQUESTED and raises an ADDITIONAL_INFO alert', async () => {
    const { service, tx, publish } = setup({
      id: 'v1',
      status: 'PENDING',
      visitorId: 'vis1',
    });
    await service.requestInfo('v1', { reason: 'Need ID' }, 'actor');
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REVIEW_REQUESTED' }),
      }),
    );
    expect(tx.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ADDITIONAL_INFO',
          level: 'MEDIUM',
        }),
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitReviewRequested }),
    );
  });

  it('checkOut returns the pass, releases the badge, and emits VisitorCheckedOut', async () => {
    const { service, tx, publish } = setup();
    await service.checkOut('v1', {}, 'actor');
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CHECKED_OUT' }),
      }),
    );
    expect(tx.pass.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RETURNED' }),
      }),
    );
    expect(tx.accessCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { passId: 'pass1' },
        data: expect.objectContaining({ passId: null }),
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitorCheckedOut }),
    );
  });
});

describe('VisitsService.createVisits', () => {
  function setup(staff: boolean) {
    const tx = {
      host: { upsert: jest.fn().mockResolvedValue({ id: 'host1' }) },
      visitor: { upsert: jest.fn().mockResolvedValue({ id: 'vis1' }) },
      visit: {
        create: jest.fn().mockResolvedValue({ id: 'v1', scheduledAt: null }),
      },
      note: { create: jest.fn().mockResolvedValue({}) },
      pass: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: {
        // host-staff validation queries all named hosts at once.
        findMany: jest.fn().mockResolvedValue(staff ? [{ id: 'staff1' }] : []),
        findUnique: jest.fn().mockResolvedValue({ fullName: 'VMC Clerk' }),
      },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new VisitsService(prisma, txm, events);
    jest.spyOn(service, 'getDetail').mockResolvedValue({ id: 'v1' } as never);
    return { service, tx, publish };
  }

  const HOST = '00000000-0000-4000-8000-000000000002';
  const inviteGuest = (
    over: Partial<CreateVisitsInput['guests'][number]> = {},
  ) => ({
    fullName: 'Daniel',
    email: 'd@x.com',
    hostUserId: HOST,
    floor: 'Floor Mezzanine',
    purpose: 'Client Meeting',
    scheduledAt: new Date(),
    ...over,
  });

  it('creates a PENDING invite per guest and emits VisitRequested (no pass)', async () => {
    const { service, tx, publish } = setup(true);
    await service.createVisits(
      {
        type: 'PRE_INVITED',
        isGroupVisit: false,
        guests: [
          inviteGuest({ fullName: 'A', email: 'a@x.com' }),
          inviteGuest({ fullName: 'B', email: 'b@x.com' }),
        ],
      },
      'actor',
    );
    expect(tx.visit.create).toHaveBeenCalledTimes(2);
    expect(tx.visit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          floor: 'Floor Mezzanine',
          referenceCode: expect.any(String),
        }),
      }),
    );
    expect(tx.pass.upsert).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitRequested }),
    );
  });

  it('auto-approves a walk-in without a pass, host, or reference code', async () => {
    const { service, tx, publish } = setup(true);
    await service.createVisits(
      {
        type: 'WALK_IN',
        isGroupVisit: false,
        guests: [
          {
            fullName: 'Walk',
            email: 'w@x.com',
            floor: '1st Floor',
            purpose: 'Delivery',
          },
        ],
      },
      'actor',
    );
    expect(tx.visit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          hostId: null,
          referenceCode: null,
        }),
      }),
    );
    expect(tx.host.upsert).not.toHaveBeenCalled();
    expect(tx.pass.upsert).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitApproved }),
    );
  });

  it('rejects a host that is not a STAFF user', async () => {
    const { service } = setup(false);
    await expect(
      service.createVisits(
        { type: 'PRE_INVITED', isGroupVisit: false, guests: [inviteGuest()] },
        'actor',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('shares one groupId + group name/email across a group visit', async () => {
    const { service, tx } = setup(true);
    await service.createVisits(
      {
        type: 'PRE_INVITED',
        isGroupVisit: true,
        groupName: 'Pentagon',
        groupContact: 'group@pentagon.com',
        guests: [
          inviteGuest({ fullName: 'A', email: 'a@x.com' }),
          inviteGuest({ fullName: 'B', email: 'b@x.com' }),
        ],
      },
      'actor',
    );
    const calls = tx.visit.create.mock.calls;
    const groupIds = calls.map((c) => c[0].data.groupId);
    expect(groupIds[0]).toEqual(expect.any(String));
    expect(groupIds[0]).toBe(groupIds[1]); // every guest shares the same group id
    for (const c of calls) {
      expect(c[0].data).toEqual(
        expect.objectContaining({
          isGroupVisit: true,
          groupName: 'Pentagon',
          groupContact: 'group@pentagon.com',
        }),
      );
    }
  });

  it('keeps bulk guests independent — no shared group id or group fields', async () => {
    const { service, tx } = setup(true);
    await service.createVisits(
      {
        type: 'PRE_INVITED',
        isGroupVisit: false,
        guests: [
          inviteGuest({ fullName: 'A', email: 'a@x.com' }),
          inviteGuest({ fullName: 'B', email: 'b@x.com' }),
        ],
      },
      'actor',
    );
    for (const c of tx.visit.create.mock.calls) {
      expect(c[0].data).toEqual(
        expect.objectContaining({
          groupId: null,
          isGroupVisit: false,
          groupName: null,
          groupContact: null,
        }),
      );
    }
  });
});

describe('VisitsService.bulkApprove / bulkDeny', () => {
  function setup() {
    const tx = {
      visit: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const count = jest.fn().mockResolvedValue(2);
    const prisma = { visit: { count } } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new VisitsService(prisma, txm, events);
    jest.spyOn(service, 'getDetail').mockResolvedValue({ id: 'x' } as never);
    return { service, tx, publish, count };
  }

  it('approves all ids and emits one VisitApproved per visit', async () => {
    const { service, tx, publish } = setup();
    await service.bulkApprove(['v1', 'v2'], 'actor');
    expect(tx.visit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['v1', 'v2'] } },
        data: { status: 'APPROVED', approvedById: 'actor' },
      }),
    );
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitApproved }),
    );
  });

  it('denies all ids with the shared reason and emits VisitDenied per visit', async () => {
    const { service, tx, publish } = setup();
    await service.bulkDeny(['v1', 'v2'], 'no pass', 'actor');
    expect(tx.visit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'DENIED', deniedReason: 'no pass' },
      }),
    );
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitDenied }),
    );
  });

  it('rejects when some ids do not exist', async () => {
    const { service, count } = setup();
    count.mockResolvedValueOnce(1); // only one of the two ids exists
    await expect(service.bulkApprove(['v1', 'v2'], 'actor')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('VisitsService.resubmit', () => {
  function setup(visit: { status: string; hostUserId: string } | null) {
    const tx = { visit: { update: jest.fn().mockResolvedValue({}) } };
    const prisma = {
      visit: {
        findUnique: jest.fn().mockResolvedValue(
          visit
            ? {
                id: 'v1',
                status: visit.status,
                host: { userId: visit.hostUserId },
              }
            : null,
        ),
      },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new VisitsService(prisma, txm, events);
    jest.spyOn(service, 'getDetail').mockResolvedValue({ id: 'v1' } as never);
    return { service, tx, publish };
  }

  it('moves a REVIEW_REQUESTED request owned by the actor back to PENDING', async () => {
    const { service, tx, publish } = setup({
      status: 'REVIEW_REQUESTED',
      hostUserId: 'me',
    });
    await service.resubmit('v1', { purpose: 'Updated' }, 'me');
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          purpose: 'Updated',
        }),
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitRequested }),
    );
  });

  it('forbids resubmitting a request the actor does not host', async () => {
    const { service } = setup({
      status: 'REVIEW_REQUESTED',
      hostUserId: 'other',
    });
    await expect(service.resubmit('v1', {}, 'me')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects resubmitting a request that is not REVIEW_REQUESTED', async () => {
    const { service } = setup({ status: 'PENDING', hostUserId: 'me' });
    await expect(service.resubmit('v1', {}, 'me')).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('VisitsService.list scoping', () => {
  function setup() {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      visit: { findMany, count },
      $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    } as unknown as PrismaService;
    const service = new VisitsService(
      prisma,
      {} as TransactionManager,
      {} as EventPublisher,
    );
    return { service, findMany };
  }

  const query = (over: Partial<VisitListQuery>): VisitListQuery => ({
    page: 1,
    pageSize: 20,
    sortDir: 'desc',
    scope: 'all',
    ...over,
  });

  it('scopes to the current user as host when scope=mine', async () => {
    const { service, findMany } = setup();
    await service.list(query({ scope: 'mine' }), 'me');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { host: { userId: 'me' } } }),
    );
  });

  it('does not host-scope the admin queue (scope=all)', async () => {
    const { service, findMany } = setup();
    await service.list(query({ status: 'PENDING' }), 'me');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } }),
    );
  });

  it('orders by scheduled date ascending with undated visits last', async () => {
    const { service, findMany } = setup();
    await service.list(query({ scope: 'all' }), 'me');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { scheduledAt: { sort: 'asc', nulls: 'last' } },
      }),
    );
  });
});

describe('VisitsService.list statuses + groupSize', () => {
  const query = (over: Partial<VisitListQuery>): VisitListQuery => ({
    page: 1,
    pageSize: 20,
    sortDir: 'desc',
    scope: 'all',
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
    const service = new VisitsService(
      prisma,
      {} as TransactionManager,
      {} as EventPublisher,
    );

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
    const service = new VisitsService(
      prisma,
      {} as TransactionManager,
      {} as EventPublisher,
    );

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
    const service = new VisitsService(
      prisma,
      {} as TransactionManager,
      {} as EventPublisher,
    );

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
    const service = new VisitsService(
      prisma,
      {} as TransactionManager,
      {} as EventPublisher,
    );

    const result = await service.list(query({ groupId: 'g1' }), 'me');

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('VisitsService.update', () => {
  function setup(visit: Record<string, unknown> | null) {
    const tx = {
      visitor: { update: jest.fn().mockResolvedValue({}) },
      host: { upsert: jest.fn().mockResolvedValue({ id: 'h1' }) },
      visit: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      visit: { findUnique: jest.fn().mockResolvedValue(visit) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'staff1' }) },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new VisitsService(prisma, txm, events);
    jest.spyOn(service, 'getDetail').mockResolvedValue({ id: 'v1' } as never);
    return { service, tx, publish };
  }

  it('updates visitor + visit fields for the creator on a pending request', async () => {
    const { service, tx, publish } = setup({
      status: 'PENDING',
      createdById: 'me',
      visitorId: 'vis1',
    });
    await service.update('v1', { fullName: 'New Name', purpose: 'X' }, 'me');
    expect(tx.visitor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'vis1' },
        data: expect.objectContaining({ fullName: 'New Name' }),
      }),
    );
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ purpose: 'X' }),
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitUpdated }),
    );
  });

  it('forbids editing a request the actor did not create', async () => {
    const { service } = setup({
      status: 'PENDING',
      createdById: 'other',
      visitorId: 'vis1',
    });
    await expect(service.update('v1', { purpose: 'X' }, 'me')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects editing an already-approved request', async () => {
    const { service } = setup({
      status: 'APPROVED',
      createdById: 'me',
      visitorId: 'vis1',
    });
    await expect(service.update('v1', { purpose: 'X' }, 'me')).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('VisitsService.cancel', () => {
  function setup(visit: Record<string, unknown> | null) {
    const tx = { visit: { update: jest.fn().mockResolvedValue({}) } };
    const prisma = {
      visit: { findUnique: jest.fn().mockResolvedValue(visit) },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new VisitsService(prisma, txm, events);
    jest.spyOn(service, 'getDetail').mockResolvedValue({ id: 'v1' } as never);
    return { service, tx, publish };
  }

  it('cancels for the creator and emits VisitCancelled', async () => {
    const { service, tx, publish } = setup({ createdById: 'me', host: null });
    await service.cancel('v1', 'me');
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } }),
    );
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitCancelled }),
    );
  });

  it('forbids cancelling for a non-owner, non-host', async () => {
    const { service } = setup({
      createdById: 'other',
      host: { userId: 'someone' },
    });
    await expect(service.cancel('v1', 'me')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('VisitsService rating, resend & operative names', () => {
  function make(visit: Record<string, unknown> | null) {
    const tx = {
      rating: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      visit: { findUnique: jest.fn().mockResolvedValue(visit) },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new VisitsService(prisma, txm, events);
    jest.spyOn(service, 'getDetail').mockResolvedValue({ id: 'v1' } as never);
    return { service, tx, publish };
  }

  it('rate upserts a rating and emits VisitorRated', async () => {
    const { service, tx, publish } = make({
      status: 'CHECKED_OUT',
      visitorId: 'vis1',
      createdById: 'actor',
      host: { userId: 'h' },
    });
    await service.rate('v1', { score: 5 }, 'actor');
    expect(tx.rating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { visitId: 'v1' } }),
    );
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitorRated }),
    );
  });

  it('rate forbids a non-owner', async () => {
    const { service } = make({
      status: 'CHECKED_OUT',
      visitorId: 'vis1',
      createdById: 'someone',
      host: { userId: 'other' },
    });
    await expect(service.rate('v1', { score: 5 }, 'actor')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rate rejects when the visit is not checked out', async () => {
    const { service } = make({
      status: 'CHECKED_IN',
      visitorId: 'vis1',
      createdById: 'actor',
      host: { userId: 'h' },
    });
    await expect(service.rate('v1', { score: 5 }, 'actor')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rate 404s for a missing visit', async () => {
    const { service } = make(null);
    await expect(service.rate('v1', { score: 5 }, 'actor')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('resendCode emits VisitInviteResent for an invite', async () => {
    const { service, publish } = make({
      type: 'PRE_INVITED',
      referenceCode: '5A19-795',
      createdById: 'actor',
      host: { userId: 'h' },
    });
    await service.resendCode('v1', 'actor');
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: EVENT_TYPES.VisitInviteResent }),
    );
  });

  it('resendCode rejects a walk-in without a reference code', async () => {
    const { service } = make({
      type: 'WALK_IN',
      referenceCode: null,
      createdById: 'actor',
      host: { userId: 'h' },
    });
    await expect(service.resendCode('v1', 'actor')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('resendCode forbids a non-owner', async () => {
    const { service } = make({
      type: 'PRE_INVITED',
      referenceCode: 'x',
      createdById: 'x',
      host: { userId: 'y' },
    });
    await expect(service.resendCode('v1', 'actor')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('getDetail resolves checked-in/out operative names from the gate log', async () => {
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
    const txm = {} as unknown as TransactionManager;
    const events = {} as unknown as EventPublisher;
    const service = new VisitsService(prisma, txm, events);

    const detail = await service.getDetail('v1');
    expect(detail.checkedInByName).toBe('Alice');
    expect(detail.checkedOutByName).toBe('Bob');
  });
});
