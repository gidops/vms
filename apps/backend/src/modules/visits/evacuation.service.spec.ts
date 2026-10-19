import { PrismaService } from '../../prisma/prisma.service';
import { VisitEvacuationService, floorRank } from './evacuation.service';

const visit = (
  id: string,
  floor: string | null,
  checkInAt: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  floor,
  checkInAt: new Date(checkInAt),
  visitor: { fullName: `Guest ${id}`, organization: 'Org', phone: '+234801' },
  host: { user: { fullName: 'Dr Alabi' } },
  pass: null,
  ...extra,
});

describe('VisitEvacuationService', () => {
  function setup(rows: unknown[], checkedIn = 9) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(checkedIn);
    const prisma = { visit: { findMany, count } } as unknown as PrismaService;
    return { service: new VisitEvacuationService(prisma), findMany, count };
  }

  it('reads only CHECKED_IN visits that answered Yes', async () => {
    const { service, findMany, count } = setup([]);
    await service.roll();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'CHECKED_IN', needsEvacuationAssist: true },
      }),
    );
    expect(count).toHaveBeenCalledWith({ where: { status: 'CHECKED_IN' } });
  });

  it('orders floors top-down, unknown floors last, check-in order within a floor', async () => {
    const { service } = setup([
      visit('a', 'Ground Floor', '2026-10-18T08:00:00Z'),
      visit('b', '5th Floor', '2026-10-18T09:00:00Z'),
      visit('c', null, '2026-10-18T07:00:00Z'),
      visit('d', '5th Floor', '2026-10-18T10:00:00Z'),
      visit('e', 'Floor Mezzanine', '2026-10-18T06:00:00Z'),
    ]);
    const roll = await service.roll(new Date('2026-10-18T22:52:00Z'));
    expect(roll.rows.map((r) => r.visitId)).toEqual(['b', 'd', 'e', 'a', 'c']);
    expect(roll.count).toBe(5);
    expect(roll.checkedInTotal).toBe(9);
    expect(roll.generatedAt.toISOString()).toBe('2026-10-18T22:52:00.000Z');
  });

  it('maps host, phone and badge', async () => {
    const { service } = setup([
      visit('a', '4th Floor', '2026-10-18T08:00:00Z', {
        host: null,
        pass: { accessCard: { cardNumber: '0019', zone: '4th Floor' } },
      }),
    ]);
    const [row] = (await service.roll()).rows;
    expect(row).toMatchObject({
      fullName: 'Guest a',
      hostName: null,
      phone: '+234801',
      badge: { cardNumber: '0019', zone: '4th Floor' },
    });
  });

  it('ranks known floors by building order', () => {
    expect(floorRank('Rooftop')).toBeGreaterThan(floorRank('5th Floor'));
    expect(floorRank('Ground Floor')).toBeGreaterThan(floorRank(null));
    expect(floorRank('Somewhere else')).toBe(-1);
  });
});
