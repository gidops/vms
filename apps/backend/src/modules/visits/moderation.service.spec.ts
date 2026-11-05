import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { VisitModerationService } from './moderation.service';
import { VisitReadService } from './read.service';

const makeRead = () =>
  ({
    getDetail: jest.fn().mockResolvedValue({ id: 'v1' }),
  }) as unknown as VisitReadService;

describe('VisitModerationService approve / flag / requestInfo', () => {
  function setup(
    visit: Record<string, unknown> = {
      id: 'v1',
      status: 'APPROVED',
      visitorId: 'vis1',
    },
  ) {
    const tx = {
      visit: { update: jest.fn().mockResolvedValue({}) },
      alert: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    };
    const prisma = {
      visit: {
        findUnique: jest.fn().mockResolvedValue(visit),
        count: jest.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new VisitModerationService(prisma, txm, events, makeRead());
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
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitApproved }),
    );
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
});

describe('VisitModerationService.bulkApprove / bulkDeny', () => {
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
    const service = new VisitModerationService(prisma, txm, events, makeRead());
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
