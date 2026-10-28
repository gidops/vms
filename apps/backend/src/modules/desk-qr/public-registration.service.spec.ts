import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../shared/config/env.schema';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SecurityAuditService } from '../../shared/audit/security-audit.service';
import type { UsersService } from '../identity/users.service';
import type { VisitAuthoringService } from '../visits/authoring.service';
import { signFormToken } from './desk-qr.tokens';
import { PublicRegistrationService } from './public-registration.service';

const SECRET = 'unit-secret';
const TOKEN = 'k7Qm2xVb9TfLw4Rz8cPd00';
const NOW = new Date('2026-10-19T09:30:00Z'); // 10:30 WAT
const QR = {
  id: 'qr1',
  token: TOKEN,
  isActive: true,
  scanDay: '2026-10-19',
  scansToday: 4,
};
const RESULT = {
  referenceCode: '7C42-318',
  fullName: 'Ifeoma Chukwu',
  hostName: null,
  visitDate: NOW,
};

function setup(qr: Partial<typeof QR> | null = QR) {
  const prisma = {
    deskQr: {
      findUnique: jest.fn().mockResolvedValue(qr ? { ...QR, ...qr } : null),
      update: jest.fn().mockResolvedValue({}),
    },
    visit: {
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const users = { isActiveHost: jest.fn().mockResolvedValue(true) };
  const createSelfRegisteredWalkIn = jest.fn().mockResolvedValue(RESULT);
  const record = jest.fn().mockResolvedValue(undefined);
  const service = new PublicRegistrationService(
    prisma as unknown as PrismaService,
    users as unknown as UsersService,
    { createSelfRegisteredWalkIn } as unknown as VisitAuthoringService,
    { get: () => SECRET } as unknown as ConfigService<Env, true>,
    { record } as unknown as SecurityAuditService,
  );
  return { service, prisma, users, createSelfRegisteredWalkIn, record };
}

const form = (over: Record<string, unknown> = {}) => ({
  formToken: signFormToken(SECRET, TOKEN, new Date(NOW.getTime() + 60_000)),
  email: 'ifeoma@gtbank.com',
  fullName: 'Ifeoma Chukwu',
  organization: 'GTBank',
  purpose: 'Official',
  needsEvacuationAssist: false,
  commsConsent: true,
  ...over,
});

const status = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return (err as HttpException).getStatus();
  }
  return 200;
};

describe('PublicRegistrationService', () => {
  it('counts a scan and opens a 10-minute form', async () => {
    const { service, prisma } = setup();
    const session = await service.open(TOKEN, NOW);
    expect(session.formExpiresAt).toEqual(new Date('2026-10-19T09:40:00Z'));
    expect(prisma.deskQr.update).toHaveBeenCalledWith({
      where: { id: 'qr1' },
      data: {
        scanDay: '2026-10-19',
        scansToday: { increment: 1 },
        lastScanAt: NOW,
      },
    });
  });

  it('restarts the scan count on a new WAT day', async () => {
    const { service, prisma } = setup({ scanDay: '2026-10-18' });
    await service.open(TOKEN, NOW);
    expect(prisma.deskQr.update.mock.calls[0][0].data.scansToday).toBe(1);
  });

  it('answers 404 for unknown, malformed and disabled codes alike', async () => {
    expect(await status(setup(null).service.open(TOKEN, NOW))).toBe(404);
    expect(await status(setup().service.open('bad token!', NOW))).toBe(404);
    expect(
      await status(setup({ isActive: false }).service.open(TOKEN, NOW)),
    ).toBe(404);
  });

  it('registers the walk-in immediately, without the form-only fields', async () => {
    const { service, createSelfRegisteredWalkIn } = setup();
    await expect(service.submit(TOKEN, form(), NOW)).resolves.toEqual(RESULT);
    const passed = createSelfRegisteredWalkIn.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(passed.fullName).toBe('Ifeoma Chukwu');
    expect(passed).not.toHaveProperty('formToken');
    expect(passed).not.toHaveProperty('website');
  });

  it('turns away expired and forged submissions', async () => {
    const expired = signFormToken(SECRET, TOKEN, new Date(NOW.getTime() - 1));
    expect(
      await status(
        setup().service.submit(TOKEN, form({ formToken: expired }), NOW),
      ),
    ).toBe(410);
    expect(
      await status(
        setup().service.submit(TOKEN, form({ formToken: '1.x' }), NOW),
      ),
    ).toBe(422);
  });

  it('traps bots: no visit, a security event, and a normal-looking answer', async () => {
    const bot = setup();
    const res = await bot.service.submit(TOKEN, form({ website: 'spam' }), NOW);
    expect(bot.createSelfRegisteredWalkIn).not.toHaveBeenCalled();
    expect(res.referenceCode).toMatch(/^[A-Z2-9]{4}-\d{3}$/);
    expect(res.hostName).toBeNull();
    expect(bot.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'desk_qr.honeypot_triggered',
        metadata: { deskQrId: 'qr1' },
      }),
    );
    // The security row never carries personal data or the QR token.
    const recorded = JSON.stringify(bot.record.mock.calls);
    expect(recorded).not.toContain('Ifeoma');
    expect(recorded).not.toContain(TOKEN);
  });

  it('refuses a host who is not active staff', async () => {
    const s = setup();
    s.users.isActiveHost.mockResolvedValue(false);
    expect(
      await status(
        s.service.submit(
          TOKEN,
          form({ hostUserId: '00000000-0000-4000-8000-000000000001' }),
          NOW,
        ),
      ),
    ).toBe(422);
    expect(s.createSelfRegisteredWalkIn).not.toHaveBeenCalled();
  });

  it('caps desk-QR walk-ins per minute', async () => {
    const s = setup();
    s.prisma.visit.count.mockResolvedValue(30);
    expect(await status(s.service.submit(TOKEN, form(), NOW))).toBe(429);
    expect(s.createSelfRegisteredWalkIn).not.toHaveBeenCalled();
    expect(s.prisma.visit.count).toHaveBeenCalledWith({
      where: {
        source: 'QR_SELF_REGISTER',
        createdAt: { gte: new Date(NOW.getTime() - 60_000) },
      },
    });
  });
});
