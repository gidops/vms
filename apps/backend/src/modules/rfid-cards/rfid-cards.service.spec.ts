import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { RfidCardsService } from './rfid-cards.service';

const VISITOR = '11111111-1111-4111-8111-111111111111';
const VISIT = '22222222-2222-4222-8222-222222222222';
const at = (iso: string) => new Date(iso);

const assignmentRow = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  cardId: 'c1',
  visitorId: VISITOR,
  visitId: null,
  validFrom: at('2026-10-24T07:00:00Z'),
  validUntil: at('2026-10-24T17:00:00Z'),
  photoKey: null,
  status: 'ACTIVE',
  issuedAt: at('2026-10-24T07:00:00Z'),
  printCount: 0,
  lastPrintedAt: null,
  returnedAt: null,
  closeNote: null,
  notes: null,
  card: { id: 'c1', cardNumber: 'RF-001' },
  visitor: {
    id: VISITOR,
    fullName: 'Ada',
    email: 'ada@x.com',
    organization: null,
  },
  issuedBy: { fullName: 'Sys Admin' },
  returnedBy: null,
  visit: null,
  ...over,
});

describe('RfidCardsService', () => {
  let tx: any;
  let prisma: any;
  let publish: jest.Mock;
  let s3: { presignGet: jest.Mock; presignVisitorPhoto: jest.Mock };
  let svc: RfidCardsService;

  const assignInput = (over: Record<string, unknown> = {}) => ({
    cardNumber: 'RF-001',
    visitorId: VISITOR,
    validFrom: at('2026-10-24T07:00:00Z'),
    validUntil: at('2026-10-24T17:00:00Z'),
    ...over,
  });

  beforeEach(() => {
    tx = {
      visitor: { findUnique: jest.fn().mockResolvedValue({ id: VISITOR }) },
      visit: { findUnique: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([]),
      rfidCard: {
        upsert: jest.fn().mockResolvedValue({
          id: 'c1',
          cardNumber: 'RF-001',
          status: 'AVAILABLE',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      rfidCardAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(assignmentRow()),
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        update: jest.fn().mockResolvedValue({ printCount: 1 }),
      },
    };
    prisma = {
      rfidCardAssignment: {
        findUnique: jest.fn().mockResolvedValue(assignmentRow()),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      rfidCard: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    publish = jest.fn().mockResolvedValue({});
    s3 = {
      presignGet: jest.fn().mockResolvedValue('https://signed/photo'),
      presignVisitorPhoto: jest.fn(),
    };
    svc = new RfidCardsService(
      prisma,
      { run: (fn: (t: unknown) => unknown) => fn(tx) } as never,
      { publish } as never,
      s3 as never,
    );
  });

  describe('assign', () => {
    it('registers the card on first use, claims it and audits the issue', async () => {
      const res = await svc.assign(assignInput(), 'admin');
      expect(tx.rfidCard.upsert).toHaveBeenCalledWith({
        where: { cardNumber: 'RF-001' },
        create: { cardNumber: 'RF-001' },
        update: {},
      });
      expect(tx.rfidCard.updateMany).toHaveBeenCalledWith({
        where: { id: 'c1', status: 'AVAILABLE' },
        data: { status: 'ASSIGNED' },
      });
      expect(tx.$queryRaw).toHaveBeenCalled(); // visitor row locked
      expect(tx.rfidCardAssignment.create.mock.calls[0][0].data).toMatchObject({
        cardId: 'c1',
        visitorId: VISITOR,
        issuedById: 'admin',
      });
      expect(publish).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          type: EVENT_TYPES.RfidCardAssigned,
          aggregateId: 'a1',
          payload: expect.objectContaining({ cardNumber: 'RF-001' }),
          metadata: { actorUserId: 'admin' },
        }),
      );
      expect(res.card.cardNumber).toBe('RF-001');
    });

    it.each([
      ['ASSIGNED', /cardInUse/],
      ['LOST', /cardLost/],
      ['RETIRED', /cardRetired/],
    ])('refuses a %s card', async (status, message) => {
      tx.rfidCard.upsert.mockResolvedValue({
        id: 'c1',
        cardNumber: 'RF-001',
        status,
      });
      tx.rfidCard.updateMany.mockResolvedValue({ count: 0 });
      await expect(svc.assign(assignInput(), 'admin')).rejects.toThrow(message);
      expect(tx.rfidCardAssignment.create).not.toHaveBeenCalled();
    });

    it('refuses a visitor who already holds a card', async () => {
      tx.rfidCardAssignment.findFirst.mockResolvedValue({ id: 'other' });
      await expect(svc.assign(assignInput(), 'admin')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.rfidCard.updateMany).not.toHaveBeenCalled();
    });

    it('refuses an unknown visitor or a visit of someone else', async () => {
      tx.visitor.findUnique.mockResolvedValueOnce(null);
      await expect(svc.assign(assignInput(), 'admin')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      tx.visit.findUnique.mockResolvedValue({ visitorId: 'someone-else' });
      await expect(
        svc.assign(assignInput({ visitId: VISIT }), 'admin'),
      ).rejects.toThrow(/visitMismatch/);
    });

    it('only stores photo keys issued for visitor photos', async () => {
      await expect(
        svc.assign(assignInput({ photoKey: 'avatars/u1/x.jpg' }), 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('close', () => {
    it('frees the card when it comes back', async () => {
      await svc.close('a1', { outcome: 'RETURNED' }, 'admin');
      expect(tx.rfidCardAssignment.update.mock.calls[0][0].data).toMatchObject({
        status: 'RETURNED',
        returnedById: 'admin',
      });
      expect(tx.rfidCard.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'AVAILABLE' },
      });
      expect(publish.mock.calls[0][1].type).toBe(EVENT_TYPES.RfidCardReturned);
    });

    it('marks the card lost', async () => {
      await svc.close(
        'a1',
        { outcome: 'LOST', note: 'Left the country' },
        'admin',
      );
      expect(tx.rfidCard.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'LOST' },
      });
      expect(publish.mock.calls[0][1]).toMatchObject({
        type: EVENT_TYPES.RfidCardLost,
        payload: expect.objectContaining({ note: 'Left the country' }),
      });
    });

    it('cannot close twice', async () => {
      tx.rfidCardAssignment.findUnique.mockResolvedValue(
        assignmentRow({ status: 'RETURNED' }),
      );
      await expect(
        svc.close('a1', { outcome: 'RETURNED' }, 'admin'),
      ).rejects.toThrow(/notActive/);
    });
  });

  it('extends validity only after valid-from, and audits the old end', async () => {
    await expect(
      svc.update('a1', { validUntil: at('2026-10-24T06:00:00Z') }, 'admin'),
    ).rejects.toThrow(/invalidValidity/);
    await svc.update('a1', { validUntil: at('2026-10-30T17:00:00Z') }, 'admin');
    expect(publish.mock.calls[0][1].payload).toMatchObject({
      validUntil: '2026-10-30T17:00:00.000Z',
      previousValidUntil: '2026-10-24T17:00:00.000Z',
    });
  });

  it('counts prints and flags reprints', async () => {
    tx.rfidCardAssignment.update.mockResolvedValue({ printCount: 2 });
    await svc.printed('a1', 'admin');
    expect(publish.mock.calls[0][1]).toMatchObject({
      type: EVENT_TYPES.RfidCardPrinted,
      payload: expect.objectContaining({ printCount: 2, reprint: true }),
    });
  });

  it('won’t retire or free a card that is out', async () => {
    tx.rfidCard.findUnique.mockResolvedValue({ id: 'c1', status: 'ASSIGNED' });
    await expect(
      svc.setCardStatus('c1', { status: 'RETIRED' }, 'admin'),
    ).rejects.toBeInstanceOf(ConflictException);
    tx.rfidCard.findUnique.mockResolvedValue({
      id: 'c1',
      cardNumber: 'RF-001',
      status: 'LOST',
    });
    await svc.setCardStatus('c1', { status: 'AVAILABLE' }, 'admin');
    expect(publish.mock.calls[0][1]).toMatchObject({
      type: EVENT_TYPES.RfidCardStatusChanged,
      payload: expect.objectContaining({ from: 'LOST', to: 'AVAILABLE' }),
    });
  });

  it('signs the photo URL and flags overdue cards', async () => {
    prisma.rfidCardAssignment.findUnique.mockResolvedValue(
      assignmentRow({
        photoKey: 'visitor-photos/p.jpg',
        validUntil: at('2020-01-01T00:00:00Z'),
      }),
    );
    const res = await svc.getAssignment('a1');
    expect(s3.presignGet).toHaveBeenCalledWith('visitor-photos/p.jpg');
    expect(res.photoUrl).toBe('https://signed/photo');
    expect(res.overdue).toBe(true);
  });

  it('lists active cards soonest-ending first, history latest first', async () => {
    await svc.listAssignments({
      view: 'active',
      page: 1,
      pageSize: 20,
      sortDir: 'desc',
    });
    await svc.listAssignments({
      view: 'history',
      search: 'ada',
      page: 1,
      pageSize: 20,
      sortDir: 'desc',
    });
    const [active, history] = prisma.rfidCardAssignment.findMany.mock.calls.map(
      (c: [{ where: unknown; orderBy: unknown }]) => c[0],
    );
    expect(active.where).toMatchObject({ status: 'ACTIVE' });
    expect(active.orderBy[0]).toEqual({ validUntil: 'asc' });
    expect(history.where).toMatchObject({ status: { not: 'ACTIVE' } });
    expect(history.where.OR).toHaveLength(4);
  });

  it('shows each registry card with its current holder', async () => {
    prisma.rfidCard.findMany.mockResolvedValue([
      {
        id: 'c1',
        cardNumber: 'RF-001',
        status: 'ASSIGNED',
        notes: null,
        createdAt: at('2026-10-01T00:00:00Z'),
        _count: { assignments: 3 },
        assignments: [
          {
            id: 'a1',
            validUntil: at('2026-10-24T17:00:00Z'),
            visitor: { fullName: 'Ada' },
          },
        ],
      },
    ]);
    prisma.rfidCard.count.mockResolvedValue(1);
    const res = await svc.listCards({ page: 1, pageSize: 20, sortDir: 'desc' });
    expect(res.items[0]).toMatchObject({
      timesIssued: 3,
      current: { assignmentId: 'a1', visitorName: 'Ada' },
    });
  });
});
