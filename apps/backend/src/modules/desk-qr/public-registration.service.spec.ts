import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../shared/config/env.schema';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EncryptionService } from '../../shared/crypto/encryption.service';
import type { EventPublisher } from '../../shared/events/event-publisher';
import type { TransactionManager } from '../../shared/events/transaction.manager';
import type { UsersService } from '../identity/users.service';
import type { NotificationService } from '../notifications/notification.service';
import type { VisitAuthoringService } from '../visits/authoring.service';
import { hashVerificationCode, signFormToken } from './desk-qr.tokens';
import { PublicRegistrationService } from './public-registration.service';

const SECRET = 'unit-secret';
const TOKEN = 'k7Qm2xVb9TfLw4Rz8cPd00';
const NOW = new Date('2026-10-19T09:30:00Z'); // 10:30 WAT
const QR = {
  id: 'qr1',
  token: TOKEN,
  isActive: true,
  codeEmail: 'desk@aatc.org',
  scanDay: '2026-10-19',
  scansToday: 4,
};

function setup(qr: Partial<typeof QR> | null = QR) {
  const prisma = {
    deskQr: {
      findUnique: jest.fn().mockResolvedValue(qr ? { ...QR, ...qr } : null),
      update: jest.fn().mockResolvedValue({}),
    },
    deskQrRegistration: {
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const tx = { deskQrRegistration: { create: jest.fn() } };
  const txm = { run: (fn: (t: unknown) => unknown) => fn(tx) };
  const publish = jest.fn().mockResolvedValue({});
  const enqueue = jest.fn().mockResolvedValue(1);
  const users = { isActiveHost: jest.fn().mockResolvedValue(true) };
  const createSelfRegisteredWalkIn = jest.fn();
  const service = new PublicRegistrationService(
    prisma as unknown as PrismaService,
    txm as unknown as TransactionManager,
    { publish } as unknown as EventPublisher,
    {
      encrypt: (v: string) => `enc(${v})`,
      decrypt: (v: string) => v.slice(4, -1),
    } as unknown as EncryptionService,
    { enqueue } as unknown as NotificationService,
    users as unknown as UsersService,
    { createSelfRegisteredWalkIn } as unknown as VisitAuthoringService,
    { get: () => SECRET } as unknown as ConfigService<Env, true>,
  );
  return {
    service,
    prisma,
    tx,
    publish,
    enqueue,
    users,
    createSelfRegisteredWalkIn,
  };
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

  it('keeps the form encrypted and emails the code to the desk', async () => {
    const { service, tx, publish, enqueue } = setup();
    const res = await service.submit(TOKEN, form(), NOW);
    const created = tx.deskQrRegistration.create.mock.calls[0][0].data;
    expect(created.payload).toMatch(/^enc\(/);
    expect(created.payload).not.toContain('formToken');
    const { code } = enqueue.mock.calls[0][0].data as { code: string };
    expect(code).toMatch(/^\d{6}$/);
    expect(created.codeHash).toBe(
      hashVerificationCode(SECRET, res.registrationId, code),
    );
    expect(enqueue.mock.calls[0][0].channels).toEqual([
      { channel: 'EMAIL', recipient: 'desk@aatc.org' },
    ]);
    // The audit event carries neither the code nor personal data.
    expect(JSON.stringify(publish.mock.calls[0][1])).not.toContain(code);
    expect(JSON.stringify(publish.mock.calls[0][1])).not.toContain('Ifeoma');
  });

  it('turns away expired, forged and bot submissions', async () => {
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
    const bot = setup();
    await bot.service.submit(TOKEN, form({ website: 'spam' }), NOW);
    expect(bot.tx.deskQrRegistration.create).not.toHaveBeenCalled();
    expect(bot.enqueue).not.toHaveBeenCalled();
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
  });

  it('undoes the registration when no email can go out', async () => {
    const s = setup();
    s.enqueue.mockResolvedValue(0);
    expect(await status(s.service.submit(TOKEN, form(), NOW))).toBe(503);
    expect(s.prisma.deskQrRegistration.delete).toHaveBeenCalled();
  });

  it('caps submissions per QR per minute', async () => {
    const s = setup();
    s.prisma.deskQrRegistration.count.mockResolvedValue(30);
    expect(await status(s.service.submit(TOKEN, form(), NOW))).toBe(429);
  });

  describe('verify', () => {
    const reg = (over: Record<string, unknown> = {}) => ({
      id: 'r1',
      deskQrId: 'qr1',
      payload: `enc(${JSON.stringify({ fullName: 'Ifeoma Chukwu' })})`,
      codeHash: hashVerificationCode(SECRET, 'r1', '123456'),
      attempts: 0,
      expiresAt: new Date(NOW.getTime() + 60_000),
      visitId: null,
      ...over,
    });

    it('creates the walk-in from the stored form and claims the registration', async () => {
      const s = setup();
      s.prisma.deskQrRegistration.findFirst.mockResolvedValue(reg());
      s.createSelfRegisteredWalkIn.mockImplementation(
        async (
          _form,
          onCreated: (tx: unknown, id: string) => Promise<void>,
        ) => {
          const updateMany = jest.fn().mockResolvedValue({ count: 1 });
          await onCreated({ deskQrRegistration: { updateMany } }, 'v1');
          expect(updateMany).toHaveBeenCalledWith({
            where: { id: 'r1', visitId: null },
            data: { visitId: 'v1', payload: '' },
          });
          return { referenceCode: '7C42-318' };
        },
      );
      await expect(
        s.service.verify(TOKEN, 'r1', '123456', NOW),
      ).resolves.toEqual({ referenceCode: '7C42-318' });
      expect(s.createSelfRegisteredWalkIn.mock.calls[0][0]).toEqual({
        fullName: 'Ifeoma Chukwu',
      });
    });

    it('counts wrong codes and locks on the third', async () => {
      const s = setup();
      s.prisma.deskQrRegistration.findFirst.mockResolvedValue(reg());
      s.prisma.deskQrRegistration.update.mockResolvedValueOnce({ attempts: 1 });
      expect(await status(s.service.verify(TOKEN, 'r1', '000000', NOW))).toBe(
        422,
      );
      s.prisma.deskQrRegistration.update.mockResolvedValueOnce({ attempts: 3 });
      expect(await status(s.service.verify(TOKEN, 'r1', '000000', NOW))).toBe(
        423,
      );
      s.prisma.deskQrRegistration.findFirst.mockResolvedValue(
        reg({ attempts: 3 }),
      );
      expect(await status(s.service.verify(TOKEN, 'r1', '123456', NOW))).toBe(
        423,
      );
      expect(s.createSelfRegisteredWalkIn).not.toHaveBeenCalled();
    });

    it('refuses expired, used and unknown registrations', async () => {
      const s = setup();
      s.prisma.deskQrRegistration.findFirst.mockResolvedValue(
        reg({ expiresAt: NOW }),
      );
      expect(await status(s.service.verify(TOKEN, 'r1', '123456', NOW))).toBe(
        410,
      );
      s.prisma.deskQrRegistration.findFirst.mockResolvedValue(null);
      expect(await status(s.service.verify(TOKEN, 'r1', '123456', NOW))).toBe(
        404,
      );
    });
  });
});
