import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../config/env.schema';
import { SeederService } from './seeder.service';

describe('SeederService role pruning', () => {
  function setup(pruneRoles: boolean) {
    const prisma = {
      permission: {
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      role: {
        upsert: jest.fn().mockResolvedValue({ id: 'role' }),
        deleteMany: jest.fn(),
      },
      rolePermission: { upsert: jest.fn(), deleteMany: jest.fn() },
    };
    const config = {
      get: (key: keyof Env) => key === 'SEED_PRUNE_ROLES' && pruneRoles,
    } as unknown as ConfigService<Env, true>;
    const service = new SeederService(
      prisma as unknown as PrismaService,
      config,
    );
    const seedRbac = () =>
      (service as unknown as { seedRbac(): Promise<void> }).seedRbac();
    return { prisma, seedRbac };
  }

  it('keeps unknown roles and their assignments by default (safe rollback)', async () => {
    const { prisma, seedRbac } = setup(false);
    await seedRbac();
    expect(prisma.role.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes roles the code no longer defines when SEED_PRUNE_ROLES is on', async () => {
    const { prisma, seedRbac } = setup(true);
    await seedRbac();
    expect(prisma.role.deleteMany).toHaveBeenCalledWith({
      where: {
        name: { notIn: expect.arrayContaining(['SUPER_ADMIN', 'VMC']) },
      },
    });
  });
});
