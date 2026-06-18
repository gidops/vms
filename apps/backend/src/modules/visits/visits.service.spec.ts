import { BadRequestException } from '@nestjs/common';
import type { CreateVisitsInput } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { VisitsService } from './visits.service';

describe('VisitsService lifecycle', () => {
  function setup() {
    const tx = {
      visit: { update: jest.fn().mockResolvedValue({}) },
      pass: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      gateEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      visit: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'v1', scheduledAt: new Date() }),
        count: jest.fn().mockResolvedValue(1),
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

  it('approve mints a pass and emits VisitApproved', async () => {
    const { service, tx, publish } = setup();
    await service.approve('v1', 'actor');
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
    expect(tx.pass.upsert).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitApproved }),
    );
  });

  it('checkIn activates the pass, logs a gate event, and emits VisitorCheckedIn', async () => {
    const { service, tx, publish } = setup();
    await service.checkIn('v1', 'actor');
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CHECKED_IN' }),
      }),
    );
    expect(tx.pass.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } }),
    );
    expect(tx.gateEvent.create).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitorCheckedIn }),
    );
  });

  it('checkOut returns the pass and emits VisitorCheckedOut', async () => {
    const { service, tx, publish } = setup();
    await service.checkOut('v1', 'actor');
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CHECKED_OUT' }),
      }),
    );
    expect(tx.pass.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RETURNED' }),
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
        findFirst: jest.fn().mockResolvedValue(staff ? { id: 'staff1' } : null),
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

  const baseInput = (over: Partial<CreateVisitsInput>): CreateVisitsInput => ({
    type: 'PRE_INVITED',
    hostUserId: '00000000-0000-4000-8000-000000000002',
    floor: 'Floor Mezzanine',
    purpose: 'Client Meeting',
    visitors: [{ fullName: 'Daniel', email: 'd@x.com' }],
    ...over,
  });

  it('creates a PENDING invite per visitor and emits VisitRequested (no pass)', async () => {
    const { service, tx, publish } = setup(true);
    await service.createVisits(
      baseInput({
        visitors: [
          { fullName: 'A', email: 'a@x.com' },
          { fullName: 'B', email: 'b@x.com' },
        ],
      }),
      'actor',
    );
    expect(tx.visit.create).toHaveBeenCalledTimes(2);
    expect(tx.visit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          floor: 'Floor Mezzanine',
        }),
      }),
    );
    expect(tx.pass.upsert).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitRequested }),
    );
  });

  it('auto-approves a walk-in: mints a pass and emits VisitApproved', async () => {
    const { service, tx, publish } = setup(true);
    await service.createVisits(baseInput({ type: 'WALK_IN' }), 'actor');
    expect(tx.visit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
    expect(tx.pass.upsert).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitApproved }),
    );
  });

  it('rejects a host that is not a STAFF user', async () => {
    const { service } = setup(false);
    await expect(service.createVisits(baseInput({}), 'actor')).rejects.toThrow(
      BadRequestException,
    );
  });
});
