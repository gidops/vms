import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { VisitAccessService } from './access.service';
import { VisitReadService } from './read.service';

const makeRead = () =>
  ({
    getDetail: jest.fn().mockResolvedValue({ id: 'v1' }),
  }) as unknown as VisitReadService;

describe('VisitAccessService check-in / check-out', () => {
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
      // No open security hold by default; the security-hold test overrides this.
      alert: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const events = { publish } as unknown as EventPublisher;
    const service = new VisitAccessService(prisma, txm, events, makeRead());
    return { service, tx, publish };
  }

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

describe('VisitAccessService.rate', () => {
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
    const service = new VisitAccessService(prisma, txm, events, makeRead());
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
});
