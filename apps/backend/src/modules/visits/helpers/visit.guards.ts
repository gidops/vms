import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export async function ensureExists(
  prisma: PrismaService,
  id: string,
): Promise<void> {
  const count = await prisma.visit.count({ where: { id } });
  if (count === 0) throw new NotFoundException('errors.visit.notFound');
}

export async function ensureAllExist(
  prisma: PrismaService,
  ids: string[],
): Promise<void> {
  const count = await prisma.visit.count({ where: { id: { in: ids } } });
  if (count !== ids.length)
    throw new NotFoundException('errors.visit.notFound');
}
