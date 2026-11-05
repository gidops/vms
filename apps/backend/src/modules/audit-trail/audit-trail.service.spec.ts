import { PassThrough } from 'node:stream';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { AUDIT_CSV_COLUMNS, AuditTrailService } from './audit-trail.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  createdAt: new Date('2026-10-24T09:30:00Z'),
  action: 'rfid_card.assigned',
  entityType: 'RfidCardAssignment',
  entityId: 'a1',
  actorUserId: 'u1',
  actor: { id: 'u1', fullName: 'Sys Admin', email: 'sa@x.com' },
  ip: '10.0.0.1',
  userAgent: 'jest',
  correlationId: 'corr-1',
  eventType: 'rfid_card.assigned',
  metadata: { cardNumber: '=RF-001' },
  ...over,
});

function collect(stream: PassThrough): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve) => {
    stream.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

describe('AuditTrailService', () => {
  let prisma: any;
  let publish: jest.Mock;
  let svc: AuditTrailService;
  const base = { from: '2026-10-24', to: '2026-10-24' };

  beforeEach(() => {
    prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    publish = jest.fn().mockResolvedValue({});
    svc = new AuditTrailService(
      prisma,
      { run: (fn: (tx: unknown) => unknown) => fn({}) } as never,
      { publish } as never,
    );
  });

  it('filters on WAT days', () => {
    const where = svc.where(base) as { AND: Record<string, unknown>[] };
    expect(where.AND[0]).toEqual({
      createdAt: {
        gte: new Date('2026-10-23T23:00:00.000Z'),
        lt: new Date('2026-10-24T23:00:00.000Z'),
      },
    });
  });

  it('matches a category by action prefix, auth covering authz', () => {
    const visit = svc.where({ ...base, category: 'visit' }) as {
      AND: unknown[];
    };
    expect(visit.AND[1]).toEqual({ action: { startsWith: 'visit.' } });
    const auth = svc.where({ ...base, category: 'auth' }) as {
      AND: unknown[];
    };
    expect(auth.AND[1]).toEqual({
      OR: [
        { action: { startsWith: 'auth.' } },
        { action: { startsWith: 'authz.' } },
      ],
    });
  });

  it('searches action, entity, correlation id and the actor', () => {
    const where = svc.where({ ...base, search: 'ada', actorUserId: 'u1' }) as {
      AND: Record<string, unknown>[];
    };
    expect(where.AND[1]).toEqual({ actorUserId: 'u1' });
    expect((where.AND[2] as { OR: unknown[] }).OR).toHaveLength(6);
  });

  it('pages newest first and labels each row with its category', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      row({ action: 'authz.permission_denied' }),
    ]);
    prisma.auditLog.count.mockResolvedValue(41);
    const res = await svc.list({
      ...base,
      page: 2,
      pageSize: 20,
      sortDir: 'desc',
    });
    expect(prisma.auditLog.findMany.mock.calls[0][0]).toMatchObject({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 20,
      take: 20,
    });
    expect(res.items[0].category).toBe('auth');
    expect(res.totalPages).toBe(3);
  });

  it('exports escaped CSV and audits the start and the finish', async () => {
    prisma.auditLog.findMany
      .mockResolvedValueOnce([row()])
      .mockResolvedValue([]);
    const out = new PassThrough();
    const done = collect(out);
    const n = await svc.write({ ...base, category: 'rfid_card' }, out, 'sa');
    const lines = (await done).split('\r\n');
    expect(n).toBe(1);
    expect(lines[0]).toBe(`\uFEFF${AUDIT_CSV_COLUMNS.join(',')}`);
    expect(lines[1]).toContain('2026-10-24 10:30');
    expect(lines[1]).toContain('rfid_card.assigned');
    // The metadata JSON is quoted (it contains commas / quotes).
    expect(lines[1]).toContain('"{""cardNumber"":""=RF-001""}"');
    expect(publish.mock.calls.map((c) => c[1].type)).toEqual([
      EVENT_TYPES.AuditExportStarted,
      EVENT_TYPES.AuditExported,
    ]);
    expect(publish.mock.calls[1][1].payload).toMatchObject({
      category: 'rfid_card',
      rowCount: 1,
    });
    expect(publish.mock.calls[0][1].aggregateId).toBe(
      publish.mock.calls[1][1].aggregateId,
    );
  });

  it('sends nothing when the start cannot be audited', async () => {
    publish.mockRejectedValueOnce(new Error('db down'));
    const out = new PassThrough();
    await expect(svc.write(base, out, 'sa')).rejects.toThrow('db down');
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
