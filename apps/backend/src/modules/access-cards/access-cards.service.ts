import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessCardOption, AccessCardQuery } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccessCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AccessCardQuery): Promise<AccessCardOption[]> {
    const where: Prisma.AccessCardWhereInput = { isActive: true };
    if (query.zone) where.zone = query.zone;
    if (query.available) where.passId = null;

    const cards = await this.prisma.accessCard.findMany({
      where,
      orderBy: [{ zone: 'asc' }, { cardNumber: 'asc' }],
    });
    return cards.map((c) => ({
      id: c.id,
      cardNumber: c.cardNumber,
      zone: c.zone ?? '',
      available: c.passId === null,
    }));
  }
}
