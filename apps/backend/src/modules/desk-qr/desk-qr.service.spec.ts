import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../shared/config/env.schema';
import type { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import type { EventPublisher } from '../../shared/events/event-publisher';
import type { TransactionManager } from '../../shared/events/transaction.manager';
import { DeskQrService } from './desk-qr.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'qr1',
  key: 'desk',
  token: 'k7Qm2xVb9TfLw4Rz8cPd00',
  isActive: true,
  disabledAt: null,
  tokenRotatedAt: new Date('2026-10-02T08:15:00Z'),
  scanDay: '2026-10-19',
  scansToday: 37,
  lastScanAt: new Date('2026-10-19T09:42:00Z'),
  createdById: 'u1',
  createdAt: new Date('2026-10-02T08:15:00Z'),
  updatedAt: new Date('2026-10-02T08:15:00Z'),
  createdBy: { fullName: 'Judith Francis' },
  ...over,
});

function setup(existing: ReturnType<typeof row> | null = row()) {
  const tx = {
    deskQr: {
      create: jest.fn().mockResolvedValue(row()),
      update: jest.fn().mockResolvedValue(row()),
      upsert: jest.fn().mockResolvedValue(row()),
    },
  };
  const prisma = {
    deskQr: {
      findUnique: jest.fn().mockResolvedValue(existing),
      findUniqueOrThrow: jest.fn().mockResolvedValue(existing ?? row()),
    },
  };
  const publish = jest.fn().mockResolvedValue({});
  const toPngBuffer = jest.fn().mockResolvedValue(Buffer.from('png'));
  const service = new DeskQrService(
    prisma as unknown as PrismaService,
    {
      run: (fn: (t: unknown) => unknown) => fn(tx),
    } as unknown as TransactionManager,
    { publish } as unknown as EventPublisher,
    { toPngBuffer },
    { get: () => 'https://vms.example.org/' } as unknown as ConfigService<
      Env,
      true
    >,
  );
  return { service, tx, publish, toPngBuffer };
}

describe('DeskQrService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-19T10:00:00Z') });
  });
  afterEach(() => jest.useRealTimers());

  it("shows the printed URL and today's scans", async () => {
    const view = await setup().service.get();
    expect(view).toMatchObject({
      url: 'https://vms.example.org/r/k7Qm2xVb9TfLw4Rz8cPd00',
      scansToday: 37,
      createdByName: 'Judith Francis',
    });
  });

  it('reports no scans yet on a new WAT day', async () => {
    const view = await setup(row({ scanDay: '2026-10-18' })).service.get();
    expect(view?.scansToday).toBe(0);
  });

  it('returns null before the QR exists, and refuses a second one', async () => {
    expect(await setup(null).service.get()).toBeNull();
    await expect(setup().service.create('u1')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('creates it with a fresh token and audits without the token', async () => {
    const s = setup(null);
    s.tx.deskQr.create.mockResolvedValue(row());
    await s.service.create('u1');
    const data = s.tx.deskQr.create.mock.calls[0][0].data;
    expect(data.token).toMatch(/^[\w-]{22}$/);
    const event = s.publish.mock.calls[0][1];
    expect(event.type).toBe(EVENT_TYPES.DeskQrCreated);
    expect(JSON.stringify(event)).not.toContain(data.token);
    expect(event.metadata).toEqual({ actorUserId: 'u1' });
  });

  it('rotates to a new token and logs it as a rotation', async () => {
    const s = setup();
    await s.service.rotate('u1');
    const data = s.tx.deskQr.update.mock.calls[0][0].data;
    expect(data.token).not.toBe(row().token);
    expect(s.publish.mock.calls[0][1].type).toBe(EVENT_TYPES.DeskQrRotated);
  });

  it('disables and enables without changing the token', async () => {
    const s = setup();
    await s.service.disable('u1');
    await s.service.enable('u1');
    const [off, on] = s.tx.deskQr.update.mock.calls.map((c) => c[0].data);
    expect(off).toMatchObject({ isActive: false });
    expect(off.disabledAt).toBeInstanceOf(Date);
    expect(on).toEqual({ isActive: true, disabledAt: null });
    expect(off).not.toHaveProperty('token');
  });

  it('imports the V1 token from the printed link', async () => {
    const s = setup();
    await s.service.importV1(
      'https://aatcabuja.com.ng/qr.php?i=0b8320ca0b0b12f1a9d0628dd18a9d48',
    );
    const args = s.tx.deskQr.upsert.mock.calls[0][0];
    expect(args.update).toMatchObject({
      token: '0b8320ca0b0b12f1a9d0628dd18a9d48',
      isActive: true,
    });
    expect(s.publish.mock.calls[0][1].type).toBe(EVENT_TYPES.DeskQrImported);
    await expect(
      s.service.importV1('https://example.org/nope'),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('renders the printed URL at print size', async () => {
    const s = setup();
    await s.service.png(1024);
    expect(s.toPngBuffer).toHaveBeenCalledWith(
      'https://vms.example.org/r/k7Qm2xVb9TfLw4Rz8cPd00',
      { width: 1024 },
    );
  });
});
