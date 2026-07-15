import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/** Throw if no visit with this id exists. */
export async function ensureExists(
  prisma: PrismaService,
  id: string,
): Promise<void> {
  const count = await prisma.visit.count({ where: { id } });
  if (count === 0) throw new NotFoundException('errors.visit.notFound');
}

/** Throw unless every id resolves to an existing visit. */
export async function ensureAllExist(
  prisma: PrismaService,
  ids: string[],
): Promise<void> {
  const count = await prisma.visit.count({ where: { id: { in: ids } } });
  if (count !== ids.length)
    throw new NotFoundException('errors.visit.notFound');
}
