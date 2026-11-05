import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController.getHealth', () => {
  it('reports a connected database', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    await expect(new AppController(prisma).getHealth()).resolves.toMatchObject({
      status: 'ok',
      database: 'connected',
    });
  });

  it('stays up but reports the database as disconnected when it fails', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as PrismaService;
    await expect(new AppController(prisma).getHealth()).resolves.toMatchObject({
      status: 'ok',
      database: 'disconnected',
      error: 'db down',
    });
  });
});
