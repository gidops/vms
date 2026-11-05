import { ConflictException, NotFoundException } from '@nestjs/common';
import { FLOORS } from '@vms/contracts';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { highestNumber, VisitorPassesService } from './visitor-passes.service';

const LW = '3rd Floor - Left Wing';
const RW = '3rd Floor - Right Wing';

function setup() {
  const tx = {
    accessCard: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    accessCardPrint: { createMany: jest.fn() },
  };
  const prisma = {
    accessCard: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    accessCardPrint: { groupBy: jest.fn().mockResolvedValue([]) },
    visit: { groupBy: jest.fn() },
    user: {
      findUnique: jest.fn().mockResolvedValue({ fullName: 'Sys Admin' }),
    },
  };
  const txm = { run: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
  const publish = jest.fn().mockResolvedValue({});
  const service = new VisitorPassesService(
    prisma as never,
    txm as never,
    { publish } as never,
  );
  return { service, tx, prisma, publish };
}

const cardRow = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  zone: LW,
  cardNumber: '001',
  passId: null,
  assignedAt: null,
  returnedAt: null,
  isActive: true,
  createdAt: new Date('2026-11-01T08:00:00Z'),
  retiredAt: null,
  retireNote: null,
  pass: null,
  prints: [],
  ...over,
});

describe('highestNumber', () => {
  it('takes the largest numeric Pass ID and ignores legacy non-numeric ones', () => {
    expect(highestNumber([])).toBe(0);
    expect(highestNumber(['001', '012', '003'])).toBe(12);
    expect(highestNumber(['A-7', '002'])).toBe(2);
  });
});

describe('VisitorPassesService.createBatch', () => {
  it('numbers each floor-wing on its own, continuing after its highest', async () => {
    const { service, tx, publish } = setup();
    tx.accessCard.findMany.mockImplementation(
      ({ where }: { where: { zone: string } }) =>
        Promise.resolve(
          where.zone === LW
            ? [{ cardNumber: '001' }, { cardNumber: '002' }]
            : [],
        ),
    );
    let n = 0;
    tx.accessCard.create.mockImplementation(() =>
      Promise.resolve({ id: `id${++n}` }),
    );

    const out = await service.createBatch(
      {
        items: [
          { zone: LW, quantity: 2 },
          { zone: RW, quantity: 1 },
        ],
      },
      'admin',
    );

    const created = tx.accessCard.create.mock.calls.map(
      ([arg]: [{ data: { zone: string; cardNumber: string } }]) => arg.data,
    );
    expect(created).toEqual([
      { zone: LW, cardNumber: '003' },
      { zone: LW, cardNumber: '004' },
      { zone: RW, cardNumber: '001' },
    ]);
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: EVENT_TYPES.VisitorPassesCreated,
        payload: expect.objectContaining({ count: 3 }),
      }),
    );
    expect(out.batchId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('numbers a floor-wing listed twice as one block', async () => {
    const { service, tx } = setup();
    tx.accessCard.findMany.mockResolvedValue([]);
    tx.accessCard.create.mockResolvedValue({ id: 'x' });
    await service.createBatch(
      {
        items: [
          { zone: LW, quantity: 1 },
          { zone: LW, quantity: 1 },
        ],
      },
      'admin',
    );
    expect(tx.accessCard.findMany).toHaveBeenCalledTimes(1);
    expect(tx.accessCard.create).toHaveBeenCalledTimes(2);
  });
});

describe('VisitorPassesService.record', () => {
  it('records the missing numbers with a RECORDED entry and skips existing ones', async () => {
    const { service, tx, publish } = setup();
    tx.accessCard.findMany.mockResolvedValue([{ cardNumber: '002' }]);

    const out = await service.record(
      { zone: LW, from: 1, to: 3, note: 'Printed in 2025' },
      'admin',
    );

    expect(out).toEqual({ created: 2, skipped: ['002'] });
    const created = tx.accessCard.create.mock.calls.map(
      ([arg]: [{ data: { cardNumber: string; prints: unknown } }]) => arg.data,
    );
    expect(created.map((c) => c.cardNumber)).toEqual(['001', '003']);
    expect(created[0].prints).toEqual({
      create: expect.objectContaining({
        kind: 'RECORDED',
        note: 'Printed in 2025',
        actorName: 'Sys Admin',
      }),
    });
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitorPassesRecorded }),
    );
  });

  it('publishes nothing when every number already exists', async () => {
    const { service, tx, publish } = setup();
    tx.accessCard.findMany.mockResolvedValue([{ cardNumber: '001' }]);
    const out = await service.record({ zone: LW, from: 1, to: 1 }, 'admin');
    expect(out).toEqual({ created: 0, skipped: ['001'] });
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('VisitorPassesService.markPrinted', () => {
  it('logs a first print as PRINTED and any later one as REPRINTED', async () => {
    const { service, tx, publish } = setup();
    tx.accessCard.findMany.mockResolvedValue([
      { id: 'new', _count: { prints: 0 } },
      { id: 'old', _count: { prints: 2 } },
    ]);

    const out = await service.markPrinted(
      { ids: ['new', 'old'], batchId: 'b1' },
      'admin',
    );

    expect(out).toEqual({ printed: 1, reprinted: 1 });
    expect(tx.accessCardPrint.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ accessCardId: 'new', kind: 'PRINTED' }),
        expect.objectContaining({ accessCardId: 'old', kind: 'REPRINTED' }),
      ],
    });
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: EVENT_TYPES.VisitorPassesPrinted,
        payload: expect.objectContaining({ reprint: true, count: 2 }),
      }),
    );
  });

  it('rejects unknown pass ids', async () => {
    const { service, tx } = setup();
    tx.accessCard.findMany.mockResolvedValue([]);
    await expect(
      service.markPrinted({ ids: ['missing'] }, 'admin'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('VisitorPassesService.retire', () => {
  it('refuses to retire a pass that is handed out', async () => {
    const { service, tx } = setup();
    tx.accessCard.findUnique.mockResolvedValue(cardRow({ passId: 'p1' }));
    await expect(
      service.retire('c1', undefined, 'admin'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.accessCard.update).not.toHaveBeenCalled();
  });

  it('takes a free pass out of service with the note', async () => {
    const { service, tx, prisma, publish } = setup();
    tx.accessCard.findUnique.mockResolvedValue(cardRow());
    prisma.accessCard.findUnique.mockResolvedValue(
      cardRow({ isActive: false, retireNote: 'Lost' }),
    );
    const out = await service.retire('c1', 'Lost', 'admin');
    expect(tx.accessCard.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({ isActive: false, retireNote: 'Lost' }),
    });
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitorPassRetired }),
    );
    expect(out.status).toBe('RETIRED');
  });
});

describe('VisitorPassesService.reactivate', () => {
  it('puts a retired pass back in service', async () => {
    const { service, tx, prisma, publish } = setup();
    tx.accessCard.findUnique.mockResolvedValue(cardRow({ isActive: false }));
    prisma.accessCard.findUnique.mockResolvedValue(cardRow());
    await service.reactivate('c1', 'admin');
    expect(tx.accessCard.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { isActive: true, retiredAt: null, retireNote: null },
    });
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: EVENT_TYPES.VisitorPassReactivated }),
    );
  });
});

describe('VisitorPassesService.demand', () => {
  it('covers every floor-wing, with traffic, stock and passes in use', async () => {
    const { service, prisma } = setup();
    prisma.visit.groupBy.mockResolvedValue([
      { floor: LW, _count: { _all: 40 } },
    ]);
    prisma.accessCard.groupBy
      .mockResolvedValueOnce([{ zone: LW, _count: { _all: 10 } }])
      .mockResolvedValueOnce([{ zone: LW, _count: { _all: 3 } }]);

    const rows = await service.demand(90, new Date('2026-11-05T00:00:00Z'));

    expect(rows).toHaveLength(FLOORS.length);
    expect(rows.find((r) => r.zone === LW)).toEqual({
      zone: LW,
      visits: 40,
      stock: 10,
      inUse: 3,
    });
    expect(rows.find((r) => r.zone === RW)).toEqual({
      zone: RW,
      visits: 0,
      stock: 0,
      inUse: 0,
    });
    expect(prisma.visit.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          checkInAt: { gte: new Date('2026-08-07T00:00:00Z') },
        }),
      }),
    );
  });
});

describe('VisitorPassesService.list', () => {
  it('derives status, origin, print count and holder', async () => {
    const { service, prisma } = setup();
    prisma.accessCard.findMany.mockResolvedValue([
      cardRow({
        id: 'c1',
        passId: 'p1',
        assignedAt: new Date('2026-11-05T09:00:00Z'),
        pass: { visit: { id: 'v1', visitor: { fullName: 'Ada Obi' } } },
      }),
      cardRow({ id: 'c2', cardNumber: '002' }),
    ]);
    prisma.accessCard.count.mockResolvedValue(2);
    prisma.accessCardPrint.groupBy.mockResolvedValue([
      {
        accessCardId: 'c1',
        kind: 'PRINTED',
        _count: { _all: 1 },
        _max: { createdAt: new Date('2026-11-01T10:00:00Z') },
      },
      {
        accessCardId: 'c1',
        kind: 'REPRINTED',
        _count: { _all: 1 },
        _max: { createdAt: new Date('2026-11-03T10:00:00Z') },
      },
      {
        accessCardId: 'c2',
        kind: 'RECORDED',
        _count: { _all: 1 },
        _max: { createdAt: new Date('2026-11-01T10:00:00Z') },
      },
    ]);

    const out = await service.list({
      page: 1,
      pageSize: 20,
      sortDir: 'desc',
      status: 'IN_USE',
    });

    expect(prisma.accessCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, passId: { not: null } },
      }),
    );
    expect(out.items[0]).toMatchObject({
      status: 'IN_USE',
      origin: 'PRINTED',
      printCount: 2,
      lastPrintedAt: new Date('2026-11-03T10:00:00Z'),
      holder: { visitId: 'v1', visitorName: 'Ada Obi' },
    });
    expect(out.items[1]).toMatchObject({
      status: 'AVAILABLE',
      origin: 'RECORDED',
      printCount: 0,
      holder: null,
    });
  });
});
