import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { NotesService } from './notes.service';

describe('NotesService.add', () => {
  const createdAt = new Date('2026-10-27T09:00:00Z');

  function setup({ visits = 1, alerts = 1, author = 'Ada VMC' } = {}) {
    const tx = {
      note: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: 'n1',
          createdAt,
          ...data,
        })),
      },
    };
    const prisma = {
      visit: { count: jest.fn().mockResolvedValue(visits) },
      alert: { count: jest.fn().mockResolvedValue(alerts) },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue(author ? { fullName: author } : null),
      },
    } as unknown as PrismaService;
    const txm = {
      run: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn();
    const service = new NotesService(prisma, txm, {
      publish,
    } as unknown as EventPublisher);
    return { service, tx, publish };
  }

  it('adds a visit note with the author name and publishes NoteAdded', async () => {
    const { service, publish } = setup();

    const note = await service.add({ visitId: 'v1', body: 'Arrived' }, 'u1');

    expect(note).toEqual({
      id: 'n1',
      visitId: 'v1',
      alertId: null,
      authorId: 'u1',
      authorName: 'Ada VMC',
      body: 'Arrived',
      createdAt,
    });
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'note.added',
        aggregateType: 'Visit',
        aggregateId: 'v1',
        payload: { noteId: 'n1' },
      }),
    );
  });

  it('attaches alert notes to the alert aggregate', async () => {
    const { service, publish } = setup();
    await service.add({ alertId: 'a1', body: 'Checked ID' }, 'u1');
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ aggregateType: 'Alert', aggregateId: 'a1' }),
    );
  });

  it('refuses notes on a missing visit or alert', async () => {
    await expect(
      setup({ visits: 0 }).service.add({ visitId: 'v1', body: 'x' }, 'u1'),
    ).rejects.toThrow(NotFoundException);
    await expect(
      setup({ alerts: 0 }).service.add({ alertId: 'a1', body: 'x' }, 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('stores an empty author name when the author no longer exists', async () => {
    const { service } = setup({ author: '' });
    const note = await service.add({ visitId: 'v1', body: 'x' }, 'gone');
    expect(note.authorName).toBe('');
  });
});
