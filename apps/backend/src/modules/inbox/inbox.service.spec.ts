import type { InboxQuery } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from './inbox.service';

const query = (over: Partial<InboxQuery> = {}): InboxQuery => ({
  page: 1,
  pageSize: 20,
  sortDir: 'desc',
  kind: 'all',
  scope: 'all',
  ...over,
});

const requestRow = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  status: 'PENDING',
  type: 'PRE_INVITED',
  purpose: 'Client Meeting',
  visitor: { fullName: 'Sophia Davis', organization: 'AMAC' },
  host: { user: { fullName: 'Dr Alabi' } },
  createdByName: 'Judith',
  createdBy: null,
  _count: { notes: 2 },
  createdAt: new Date('2026-06-01T10:00:00Z'),
  updatedAt: new Date('2026-06-01T10:00:00Z'),
  ...over,
});

const alertRow = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  status: 'OPEN',
  level: 'HIGH',
  category: 'Restricted Guest',
  reason: 'Matches a flagged profile',
  raisedById: null,
  visitor: { fullName: 'Sophia Davis', organization: 'AMAC' },
  _count: { notes: 1 },
  createdAt: new Date('2026-06-02T10:00:00Z'),
  updatedAt: new Date('2026-06-02T10:00:00Z'),
  ...over,
});

function setup(opts: {
  requests?: Record<string, unknown>[];
  alerts?: Record<string, unknown>[];
  lastInboxSeenAt?: Date | null;
}) {
  const findManyVisit = jest.fn().mockResolvedValue(opts.requests ?? []);
  const findManyAlert = jest.fn().mockResolvedValue(opts.alerts ?? []);
  const userUpdate = jest.fn().mockResolvedValue({});
  const prisma = {
    visit: { findMany: findManyVisit },
    alert: { findMany: findManyAlert },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ lastInboxSeenAt: opts.lastInboxSeenAt ?? null }),
      findMany: jest.fn().mockResolvedValue([]),
      update: userUpdate,
    },
  } as unknown as PrismaService;
  const service = new InboxService(prisma);
  return { service, findManyVisit, findManyAlert, userUpdate };
}

describe('InboxService.list', () => {
  it('flags items whose updatedAt is newer than the user last-seen time', async () => {
    const { service } = setup({
      requests: [
        requestRow({ id: 'old', updatedAt: new Date('2026-06-01T00:00:00Z') }),
        requestRow({ id: 'new', updatedAt: new Date('2026-06-03T00:00:00Z') }),
      ],
      lastInboxSeenAt: new Date('2026-06-02T00:00:00Z'),
    });
    const res = await service.list(query({ kind: 'requests' }), 'me');
    const byId = Object.fromEntries(res.items.map((i) => [i.id, i.unread]));
    expect(byId.new).toBe(true);
    expect(byId.old).toBe(false);
  });

  it('sorts newest activity first', async () => {
    const { service } = setup({
      requests: [requestRow({ id: 'r', updatedAt: new Date('2026-06-01Z') })],
      alerts: [alertRow({ id: 'a', updatedAt: new Date('2026-06-05Z') })],
    });
    const res = await service.list(query(), 'me');
    expect(res.items[0].id).toBe('a');
    expect(res.items[1].id).toBe('r');
  });

  it('exposes structured request fields for client-side title composition', async () => {
    const { service } = setup({ requests: [requestRow()] });
    const res = await service.list(query({ kind: 'requests' }), 'me');
    const item = res.items[0];
    expect(item).toMatchObject({
      kind: 'request',
      visitorName: 'Sophia Davis',
      hostName: 'Dr Alabi',
      type: 'PRE_INVITED',
      purpose: 'Client Meeting',
    });
  });

  it('drops alerts when filtering by a request status', async () => {
    const { service, findManyVisit, findManyAlert } = setup({
      requests: [requestRow()],
      alerts: [alertRow()],
    });
    const res = await service.list(query({ status: 'PENDING' }), 'me');
    expect(findManyVisit).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } }),
    );
    expect(findManyAlert).not.toHaveBeenCalled();
    expect(res.items.every((i) => i.kind === 'request')).toBe(true);
  });

  it('applies an alert status only to the alert side', async () => {
    const { service, findManyVisit, findManyAlert } = setup({
      alerts: [alertRow()],
    });
    await service.list(query({ status: 'OPEN' }), 'me');
    expect(findManyAlert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'OPEN' } }),
    );
    expect(findManyVisit).not.toHaveBeenCalled();
  });

  it('searches across structured fields', async () => {
    const { service } = setup({
      requests: [
        requestRow({
          id: 'match',
          visitor: { fullName: 'Zara', organization: 'X' },
        }),
        requestRow({
          id: 'miss',
          visitor: { fullName: 'Bob', organization: 'Y' },
        }),
      ],
    });
    const res = await service.list(
      query({ kind: 'requests', search: 'zara' }),
      'me',
    );
    expect(res.items.map((i) => i.id)).toEqual(['match']);
  });
});

describe('InboxService.unreadCount', () => {
  it('counts only unread items in scope', async () => {
    const { service } = setup({
      requests: [
        requestRow({ id: 'a', updatedAt: new Date('2026-06-03Z') }),
        requestRow({ id: 'b', updatedAt: new Date('2026-06-03Z') }),
        requestRow({ id: 'c', updatedAt: new Date('2026-05-01Z') }),
      ],
      lastInboxSeenAt: new Date('2026-06-02Z'),
    });
    const res = await service.unreadCount(query(), 'me');
    expect(res.unread).toBe(2);
  });
});

describe('InboxService.markSeen', () => {
  it('stamps the user last-seen time', async () => {
    const { service, userUpdate } = setup({});
    await service.markSeen('me');
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'me' },
        data: expect.objectContaining({ lastInboxSeenAt: expect.any(Date) }),
      }),
    );
  });
});
