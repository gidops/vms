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
