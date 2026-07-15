import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { CreateVisitsInput } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { VisitAuthoringService } from './authoring.service';
import { VisitReadService } from './read.service';

const makeRead = () =>
  ({
    getDetail: jest.fn().mockResolvedValue({ id: 'v1' }),
  }) as unknown as VisitReadService;

describe('VisitAuthoringService.createVisits', () => {
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
    const service = new VisitAuthoringService(prisma, txm, events, makeRead());
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

describe('VisitAuthoringService.resubmit', () => {
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
    const service = new VisitAuthoringService(prisma, txm, events, makeRead());
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

describe('VisitAuthoringService.update', () => {
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
    const service = new VisitAuthoringService(prisma, txm, events, makeRead());
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

describe('VisitAuthoringService.cancel', () => {
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
    const service = new VisitAuthoringService(prisma, txm, events, makeRead());
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

describe('VisitAuthoringService.resendCode', () => {
  function make(visit: Record<string, unknown> | null) {
    const tx = {};
    const prisma = {
      visit: { findUnique: jest.fn().mockResolvedValue(visit) },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new VisitAuthoringService(prisma, txm, events, makeRead());
    return { service, publish };
  }

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
});
