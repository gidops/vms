import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
    };
    const prisma = {
      visit: {
        findUnique: jest.fn().mockResolvedValue(visit),
        count: jest.fn().mockResolvedValue(1),
      },
      accessCard: { findUnique: jest.fn().mockResolvedValue(card) },
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
        { type: 'PRE_INVITED', guests: [inviteGuest()] },
        'actor',
      ),
    ).rejects.toThrow(BadRequestException);
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

  it('moves a NEEDS_MORE_INFO request owned by the actor back to PENDING', async () => {
    const { service, tx, publish } = setup({
      status: 'NEEDS_MORE_INFO',
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
      status: 'NEEDS_MORE_INFO',
      hostUserId: 'other',
    });
    await expect(service.resubmit('v1', {}, 'me')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects resubmitting a request that is not NEEDS_MORE_INFO', async () => {
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
});
