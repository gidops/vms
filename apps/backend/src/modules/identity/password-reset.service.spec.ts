import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService.requestReset', () => {
  let prisma: any;
  let tx: any;
  let txm: any;
  let events: any;
  let notifications: any;
  let config: any;
  let svc: PasswordResetService;

  const user = {
    id: 'u1',
    email: 'staff@aatc.org',
    fullName: 'Staff Member',
    authProvider: 'LOCAL',
    isActive: true,
    preferredLocale: 'EN',
  };

  beforeEach(() => {
    tx = {
      passwordResetToken: { deleteMany: jest.fn(), create: jest.fn() },
    };
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      passwordResetToken: { deleteMany: jest.fn() },
    };
    txm = { run: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    events = { publish: jest.fn() };
    notifications = { enqueue: jest.fn().mockResolvedValue(1) };
    config = {
      get: jest.fn((key: string) =>
        key === 'EMAIL_ENABLED' ? true : 'http://localhost:3000',
      ),
    };
    svc = new PasswordResetService(prisma, txm, events, notifications, config);
  });

  it('supersedes old tokens, stores a hash, publishes the event, and emails the raw link', async () => {
    const { expiresAt } = await svc.requestReset('u1', 'admin1');

    expect(tx.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', usedAt: null },
    });
    const created = tx.passwordResetToken.create.mock.calls[0][0].data;
    expect(created.userId).toBe('u1');
    expect(created.createdById).toBe('admin1');
    // sha256 hex at rest, never the raw token.
    expect(created.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(events.publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: EVENT_TYPES.PasswordResetRequested,
        aggregateId: 'u1',
        metadata: { actorUserId: 'admin1' },
      }),
    );

    const spec = notifications.enqueue.mock.calls[0][0];
    expect(spec.templateKey).toBe('user.password_reset');
    expect(spec.channels[0].recipient).toBe('staff@aatc.org');
    const url = (spec.data as { resetUrl: string }).resetUrl;
    expect(url).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=/);
    // The emailed token must be the raw one (the hash is useless to the user).
    expect(url).not.toContain(created.tokenHash);
  });

  it('rejects an unknown user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(svc.requestReset('ghost', 'admin1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects SSO-only accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      authProvider: 'OKTA',
    });
    await expect(svc.requestReset('u1', 'admin1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(notifications.enqueue).not.toHaveBeenCalled();
  });

  it('rejects deactivated accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false });
    await expect(svc.requestReset('u1', 'admin1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('fails fast when email delivery is disabled, before any token exists', async () => {
    config.get = jest.fn((key: string) =>
      key === 'EMAIL_ENABLED' ? false : 'http://localhost:3000',
    );
    await expect(svc.requestReset('u1', 'admin1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(txm.run).not.toHaveBeenCalled();
  });

  it('deletes the token when the email could not be queued', async () => {
    notifications.enqueue.mockResolvedValue(0);
    await expect(svc.requestReset('u1', 'admin1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: {
        tokenHash: tx.passwordResetToken.create.mock.calls[0][0].data.tokenHash,
      },
    });
  });
});
