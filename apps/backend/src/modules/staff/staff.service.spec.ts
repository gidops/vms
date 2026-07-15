import type { StaffActivityQuery } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffService } from './staff.service';

describe('StaffService.stats', () => {
  it('counts expected-today / awaiting-approval / onsite, scoped to created-or-hosted', async () => {
    const count = jest
      .fn()
      .mockResolvedValueOnce(4) // expectedToday
      .mockResolvedValueOnce(28) // awaitingApproval
      .mockResolvedValueOnce(2); // onsite
    const prisma = { visit: { count } } as unknown as PrismaService;
    const service = new StaffService(prisma);

    const stats = await service.stats('me');

    expect(stats).toEqual({
      expectedToday: 4,
      awaitingApproval: 28,
      onsite: 2,
    });
    // Every count is scoped to visits the user created OR hosts, so a staff's
    // own requests count even when the guest is hosted by someone else.
    for (const call of count.mock.calls) {
      expect(call[0].where.OR).toEqual([
        { createdById: 'me' },
        { host: { userId: 'me' } },
      ]);
    }
    // Awaiting-approval folds in REVIEW_REQUESTED alongside PENDING.
    expect(count.mock.calls[1][0].where.status).toEqual({
      in: ['PENDING', 'REVIEW_REQUESTED'],
    });
  });
});

describe('StaffService.activityFeed', () => {
  const query = (
    over: Partial<StaffActivityQuery> = {},
  ): StaffActivityQuery => ({
    page: 1,
    pageSize: 20,
    sortDir: 'desc',
    ...over,
  });

  it('returns an empty page when the host has no visits or alerts', async () => {
    const prisma = {
      visit: { findMany: jest.fn().mockResolvedValue([]) },
      alert: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new StaffService(prisma);

    const page = await service.activityFeed('me', query());

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('maps audit rows to feed cards with the visitor name and link', async () => {
    const prisma = {
      visit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'v1',
            visitorId: 'vis1',
            visitor: { fullName: 'Sophia Davis' },
          },
        ]),
      },
      alert: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            action: 'visit.approved',
            entityType: 'Visit',
            entityId: 'v1',
            createdAt: new Date('2026-06-24T10:00:00Z'),
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    } as unknown as PrismaService;
    const service = new StaffService(prisma);

    const page = await service.activityFeed('me', query());

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toEqual(
      expect.objectContaining({
        category: 'REQUEST_UPDATE',
        title: 'Request Approved',
        body: "Sophia Davis's visit has been approved.",
        visitId: 'v1',
        alertId: null,
      }),
    );
  });
});

describe('StaffService.activityFeed category filter', () => {
  it('narrows the audit actions to the requested category', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      visit: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'v1', visitorId: 'vis1', visitor: { fullName: 'X' } },
          ]),
      },
      alert: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { findMany, count: jest.fn().mockResolvedValue(0) },
      $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    } as unknown as PrismaService;
    const service = new StaffService(prisma);

    await service.activityFeed('me', {
      page: 1,
      pageSize: 20,
      sortDir: 'desc',
      category: 'VISIT_STATUS',
    });

    const actions = findMany.mock.calls[0][0].where.action.in as string[];
    expect(actions).toEqual(
      expect.arrayContaining(['visitor.checked_in', 'visitor.checked_out']),
    );
    expect(actions).not.toContain('visit.approved');
  });
});
