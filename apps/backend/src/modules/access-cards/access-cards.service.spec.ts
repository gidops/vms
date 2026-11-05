import { PrismaService } from '../../prisma/prisma.service';
import { AccessCardsService } from './access-cards.service';

describe('AccessCardsService.list', () => {
  function setup(rows: Record<string, unknown>[]) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const prisma = { accessCard: { findMany } } as unknown as PrismaService;
    return { service: new AccessCardsService(prisma), findMany };
  }

  it('maps badges to options and marks availability from passId', async () => {
    const { service } = setup([
      {
        id: 'c1',
        cardNumber: '0001',
        zone: '5th Floor - left wing',
        passId: null,
      },
      {
        id: 'c2',
        cardNumber: '0002',
        zone: '5th Floor - left wing',
        passId: 'p1',
      },
    ]);
    const out = await service.list({});
    expect(out).toEqual([
      {
        id: 'c1',
        cardNumber: '0001',
        zone: '5th Floor - left wing',
        available: true,
      },
      {
        id: 'c2',
        cardNumber: '0002',
        zone: '5th Floor - left wing',
        available: false,
      },
    ]);
  });

  it('filters to in-service badges, by zone and availability', async () => {
    const { service, findMany } = setup([]);
    await service.list({ zone: 'Rooftop', available: true });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, zone: 'Rooftop', passId: null },
      }),
    );
  });
});
