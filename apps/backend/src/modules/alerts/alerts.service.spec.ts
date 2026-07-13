import { NotFoundException } from '@nestjs/common';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { AlertsService } from './alerts.service';

describe('AlertsService.updateStatus', () => {
  function setup(
    alert: Record<string, unknown> | null = {
      id: 'a1',
      visitId: 'v1',
      type: 'SECURITY_REVIEW',
    },
    visit: Record<string, unknown> | null = { status: 'FLAGGED' },
    remainingOpen = 0,
  ) {
    const tx = {
      alert: {
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(remainingOpen),
      },
      visit: {
        findUnique: jest.fn().mockResolvedValue(visit),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      alert: { findUnique: jest.fn().mockResolvedValue(alert) },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new AlertsService(prisma, txm, events);
    jest.spyOn(service, 'getDetail').mockResolvedValue({ id: 'a1' } as never);
    return { service, tx, publish };
  }

  it('throws when the alert does not exist', async () => {
    const { service } = setup(null);
    await expect(
      service.updateStatus('a1', { status: 'RESOLVED' }, 'sm'),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolving a flag clears the hold — visit returns to APPROVED', async () => {
    const { service, tx, publish } = setup();
    await service.updateStatus('a1', { status: 'RESOLVED' }, 'sm');
    expect(tx.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RESOLVED',
          resolvedById: 'sm',
        }),
      }),
    );
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v1' },
        data: { status: 'APPROVED' },
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.AlertUpdated }),
    );
  });

  it('resolving an additional-info alert returns the visit to PENDING', async () => {
    const { service, tx } = setup(
      { id: 'a1', visitId: 'v1', type: 'ADDITIONAL_INFO' },
      { status: 'REVIEW_REQUESTED' },
    );
    await service.updateStatus('a1', { status: 'RESOLVED' }, 'sm');
    expect(tx.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PENDING' } }),
    );
  });

  it('does not clear the hold while another open security alert remains', async () => {
    const { service, tx } = setup(undefined, { status: 'FLAGGED' }, 1);
    await service.updateStatus('a1', { status: 'RESOLVED' }, 'sm');
    expect(tx.visit.update).not.toHaveBeenCalled();
  });

  it('acknowledging (non-closing) does not touch the visit or stamp a resolver', async () => {
    const { service, tx } = setup();
    await service.updateStatus('a1', { status: 'ACKNOWLEDGED' }, 'sm');
    expect(tx.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resolvedById: null }),
      }),
    );
    expect(tx.visit.findUnique).not.toHaveBeenCalled();
    expect(tx.visit.update).not.toHaveBeenCalled();
  });
});
