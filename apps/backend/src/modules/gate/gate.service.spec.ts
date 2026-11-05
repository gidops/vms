import { GateService } from './gate.service';

describe('GateService.verify', () => {
  let prisma: any;
  let tx: any;
  let publish: jest.Mock;
  let svc: GateService;

  const occurredAt = new Date('2026-10-28T09:05:00Z');
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'v1',
    type: 'PRE_INVITED',
    status: 'APPROVED',
    scheduledAt: new Date(),
    gateValidatedAt: null,
    visitorNameAtVisit: null,
    organizationAtVisit: null,
    visitor: { fullName: 'Ada Lovelace', organization: 'Acme' },
    host: { user: { fullName: 'Dr Alabi' } },
    ...over,
  });

  beforeEach(() => {
    tx = {
      gateEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ge1', occurredAt }),
      },
      visit: { update: jest.fn() },
      gateKiosk: { update: jest.fn() },
    };
    prisma = { visit: { findUnique: jest.fn() } };
    const txm = { run: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    publish = jest.fn();
    svc = new GateService(prisma, txm as never, { publish } as never);
  });

  it('logs a valid scan against the kiosk, stamps gateValidatedAt and describes the visit', async () => {
    prisma.visit.findUnique.mockResolvedValue(row());

    const result = await svc.verify({ code: 'ABCD-123', source: 'scan' }, 'k1');

    expect(prisma.visit.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { referenceCode: 'ABCD-123' } }),
    );
    expect(tx.gateEvent.create).toHaveBeenCalledWith({
      data: {
        visitId: 'v1',
        gateId: 'MAIN',
        type: 'QR_SCAN',
        operativeUserId: null,
        result: 'VALID_TODAY',
        metadata: { code: 'ABCD-123', source: 'scan', kioskId: 'k1' },
      },
    });
    expect(tx.gateKiosk.update).toHaveBeenCalledWith({
      where: { id: 'k1' },
      data: { lastScanAt: occurredAt },
    });
    expect(tx.visit.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { gateValidatedAt: occurredAt },
    });
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'gate.code_checked',
        aggregateType: 'Visit',
        aggregateId: 'v1',
        payload: {
          verdict: 'VALID_TODAY',
          source: 'scan',
          code: 'ABCD-123',
          kioskId: 'k1',
        },
        // No user at the kiosk: the audit entry has no actor.
        metadata: {},
      }),
    );
    expect(result).toEqual({
      verdict: 'VALID_TODAY',
      visit: {
        visitorName: 'Ada Lovelace',
        organization: 'Acme',
        hostName: 'Dr Alabi',
        scheduledAt: expect.any(Date),
        status: 'APPROVED',
      },
    });
  });

  it('keeps the first gate time on a repeat valid scan', async () => {
    prisma.visit.findUnique.mockResolvedValue(
      row({ gateValidatedAt: new Date('2026-10-28T08:00:00Z') }),
    );
    await svc.verify({ code: 'ABCD-123', source: 'manual' }, 'k1');
    expect(tx.visit.update).not.toHaveBeenCalled();
    expect(tx.gateEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'INVITATION_VERIFY' }),
    });
  });

  it('does not stamp the visit for a wrong-day scan but still logs it', async () => {
    prisma.visit.findUnique.mockResolvedValue(
      row({ scheduledAt: new Date(Date.now() + 3 * 86_400_000) }),
    );
    const result = await svc.verify({ code: 'ABCD-123', source: 'scan' }, 'k1');
    expect(result.verdict).toBe('WRONG_DAY');
    expect(result.visit?.visitorName).toBe('Ada Lovelace');
    expect(tx.visit.update).not.toHaveBeenCalled();
    expect(tx.gateEvent.create).toHaveBeenCalled();
  });

  it('uses the identity recorded on the visit when it differs from the visitor record', async () => {
    prisma.visit.findUnique.mockResolvedValue(
      row({ visitorNameAtVisit: 'Ada King', organizationAtVisit: null }),
    );
    const result = await svc.verify({ code: 'ABCD-123', source: 'scan' }, 'k1');
    expect(result.visit).toMatchObject({
      visitorName: 'Ada King',
      organization: 'Acme',
    });
  });

  it('logs an unknown code against the gate event and reveals nothing', async () => {
    prisma.visit.findUnique.mockResolvedValue(null);
    const result = await svc.verify(
      { code: 'ZZZZ-999', source: 'manual' },
      'k1',
    );
    expect(result).toEqual({ verdict: 'NOT_FOUND', visit: null });
    expect(tx.gateEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ visitId: null, result: 'NOT_FOUND' }),
    });
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        aggregateType: 'GateEvent',
        aggregateId: 'ge1',
      }),
    );
  });

  it('does not describe a walk-in visit found by its code', async () => {
    prisma.visit.findUnique.mockResolvedValue(row({ type: 'WALK_IN' }));
    const result = await svc.verify({ code: 'ABCD-123', source: 'scan' }, 'k1');
    expect(result).toEqual({ verdict: 'NOT_FOUND', visit: null });
    expect(tx.gateEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ visitId: null }),
    });
    expect(tx.visit.update).not.toHaveBeenCalled();
  });
});
