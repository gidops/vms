import { ConflictException, NotFoundException } from '@nestjs/common';
import { GATE_KIOSK_TOKEN_RE } from '@vms/contracts';
import { GateKioskService, newKioskToken } from './gate-kiosk.service';

describe('GateKioskService', () => {
  let prisma: any;
  let tx: any;
  let publish: jest.Mock;
  let qr: { toPngBuffer: jest.Mock };
  let svc: GateKioskService;

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'k1',
    key: 'gate',
    token: 'tok_tok_tok_tok_tok_1',
    isActive: true,
    disabledAt: null,
    tokenRotatedAt: new Date('2026-10-28T08:00:00Z'),
    lastScanAt: null,
    createdById: 'sa1',
    createdAt: new Date('2026-10-28T08:00:00Z'),
    updatedAt: new Date('2026-10-28T08:00:00Z'),
    createdBy: { fullName: 'System Admin' },
    ...over,
  });

  beforeEach(() => {
    tx = { gateKiosk: { create: jest.fn(), update: jest.fn() } };
    prisma = {
      gateKiosk: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    const txm = { run: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    publish = jest.fn();
    qr = { toPngBuffer: jest.fn().mockResolvedValue(Buffer.from('png')) };
    const config = { get: () => 'https://vms.example/' };
    svc = new GateKioskService(
      prisma,
      txm as never,
      { publish } as never,
      qr,
      config as never,
    );
  });

  it('makes base64url tokens the public route accepts', () => {
    const a = newKioskToken();
    expect(a).toMatch(GATE_KIOSK_TOKEN_RE);
    expect(newKioskToken()).not.toBe(a);
  });

  it('shows nothing before the link is created', async () => {
    prisma.gateKiosk.findUnique.mockResolvedValue(null);
    await expect(svc.get()).resolves.toBeNull();
  });

  it('creates the link once and audits it without the token', async () => {
    prisma.gateKiosk.findUnique.mockResolvedValue(null);
    tx.gateKiosk.create.mockResolvedValue(row());
    prisma.gateKiosk.findUniqueOrThrow.mockResolvedValue(row());

    const view = await svc.create('sa1');

    expect(tx.gateKiosk.create).toHaveBeenCalledWith({
      data: {
        key: 'gate',
        token: expect.stringMatching(GATE_KIOSK_TOKEN_RE),
        createdById: 'sa1',
      },
    });
    expect(view).toMatchObject({
      id: 'k1',
      isActive: true,
      url: 'https://vms.example/gate/tok_tok_tok_tok_tok_1',
      createdByName: 'System Admin',
    });
    expect(publish).toHaveBeenCalledWith(tx, {
      type: 'gate.kiosk_created',
      aggregateType: 'GateKiosk',
      aggregateId: 'k1',
      payload: { gateKioskId: 'k1' },
      metadata: { actorUserId: 'sa1' },
    });
    expect(JSON.stringify(publish.mock.calls)).not.toContain('tok_tok');

    prisma.gateKiosk.findUnique.mockResolvedValue(row());
    await expect(svc.create('sa1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rotates to a fresh token', async () => {
    prisma.gateKiosk.findUnique.mockResolvedValue(row());
    prisma.gateKiosk.findUniqueOrThrow.mockResolvedValue(row());
    await svc.rotate('sa1');
    const data = tx.gateKiosk.update.mock.calls[0][0].data;
    expect(data.token).toMatch(GATE_KIOSK_TOKEN_RE);
    expect(data.token).not.toBe('tok_tok_tok_tok_tok_1');
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: 'gate.kiosk_rotated' }),
    );
  });

  it('disables and enables without changing the token', async () => {
    prisma.gateKiosk.findUnique.mockResolvedValue(row());
    prisma.gateKiosk.findUniqueOrThrow.mockResolvedValue(row());
    await svc.disable('sa1');
    expect(tx.gateKiosk.update).toHaveBeenLastCalledWith({
      where: { id: 'k1' },
      data: { isActive: false, disabledAt: expect.any(Date) },
    });
    await svc.enable('sa1');
    expect(tx.gateKiosk.update).toHaveBeenLastCalledWith({
      where: { id: 'k1' },
      data: { isActive: true, disabledAt: null },
    });
  });

  it('refuses to change a link that does not exist', async () => {
    prisma.gateKiosk.findUnique.mockResolvedValue(null);
    await expect(svc.rotate('sa1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.png()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renders the kiosk link as a QR', async () => {
    prisma.gateKiosk.findUnique.mockResolvedValue(row());
    await svc.png(512);
    expect(qr.toPngBuffer).toHaveBeenCalledWith(
      'https://vms.example/gate/tok_tok_tok_tok_tok_1',
      { width: 512 },
    );
  });

  describe('activeKiosk', () => {
    it('accepts the live link', async () => {
      prisma.gateKiosk.findUnique.mockResolvedValue(row());
      await expect(svc.activeKiosk('tok_tok_tok_tok_tok_1')).resolves.toEqual(
        expect.objectContaining({ id: 'k1' }),
      );
    });

    it('answers 404 alike for disabled, unknown and malformed links', async () => {
      prisma.gateKiosk.findUnique.mockResolvedValue(row({ isActive: false }));
      await expect(
        svc.activeKiosk('tok_tok_tok_tok_tok_1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.gateKiosk.findUnique.mockResolvedValue(null);
      await expect(
        svc.activeKiosk('unknown_token_000000'),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.gateKiosk.findUnique.mockClear();
      await expect(svc.activeKiosk('bad token!')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.gateKiosk.findUnique).not.toHaveBeenCalled();
    });
  });
});
