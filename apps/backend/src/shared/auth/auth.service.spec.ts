import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { EVENT_TYPES } from '../events/domain-event';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let local: any;
  let tokens: any;
  let refreshTokens: any;
  let users: any;
  let passwords: any;
  let prisma: any;
  let txm: any;
  let events: any;
  let security: any;
  let svc: AuthService;

  const user = {
    id: 'u1',
    email: 'a@b.c',
    fullName: 'A',
    preferredLocale: 'en',
    roles: ['ADMIN'],
    isActive: true,
    tenantId: null,
  };

  beforeEach(() => {
    local = { authenticate: jest.fn() };
    tokens = {
      signAccessToken: jest.fn().mockResolvedValue('access'),
      accessTokenTtlSeconds: () => 900,
    };
    refreshTokens = {
      issueForNewSession: jest
        .fn()
        .mockResolvedValue({ token: 'refresh', sessionId: 's1' }),
      rotate: jest.fn(),
      revoke: jest.fn(),
      setSessionActiveRole: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    users = {
      defaultRole: () => 'ADMIN',
      permissionsForRole: () => ['p'],
      findByIdWithAccess: jest.fn(),
      create: jest.fn(),
    };
    passwords = { verify: jest.fn(), hash: jest.fn() };
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    };
    txm = {
      run: jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb({ user: { update: jest.fn().mockResolvedValue({}) } }),
      ),
    };
    events = { publish: jest.fn().mockResolvedValue(undefined) };
    security = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new AuthService(
      local,
      tokens,
      refreshTokens,
      users,
      passwords,
      prisma,
      txm,
      events,
      security,
    );
  });

  it('login succeeds, starts a session, and emits UserLoggedIn', async () => {
    local.authenticate.mockResolvedValue(user);
    const result = await svc.login({ email: 'a@b.c', password: 'pw' }, {});
    expect(result.tokens.accessToken).toBe('access');
    expect(result.refreshToken).toBe('refresh');
    expect(events.publish).toHaveBeenCalled();
    expect(security.record).not.toHaveBeenCalled();
  });

  it('login failure records auth.login_failed and rethrows', async () => {
    local.authenticate.mockRejectedValue(
      new UnauthorizedException('Invalid credentials'),
    );
    await expect(
      svc.login({ email: 'bad@b.c', password: 'x' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: EVENT_TYPES.LoginFailed,
        metadata: { email: 'bad@b.c' },
      }),
    );
  });

  it('signup bootstraps the first SUPER_ADMIN while no users exist', async () => {
    prisma.user.count.mockResolvedValue(0);
    users.create.mockResolvedValue(user);
    const result = await svc.signup(
      { email: 'a@b.c', fullName: 'A', password: 'pw' },
      {},
    );
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['SUPER_ADMIN'] }),
    );
    expect(result.tokens.accessToken).toBe('access');
  });

  it('signup is refused once any user exists, and records auth.signup_blocked', async () => {
    prisma.user.count.mockResolvedValue(1);
    await expect(
      svc.signup(
        { email: 'attacker@evil.com', fullName: 'X', password: 'pw' },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.create).not.toHaveBeenCalled();
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: EVENT_TYPES.SignupBlocked,
        metadata: { email: 'attacker@evil.com' },
      }),
    );
  });

  it('signupAvailable reflects whether any user exists', async () => {
    prisma.user.count.mockResolvedValue(0);
    await expect(svc.signupAvailable()).resolves.toBe(true);
    prisma.user.count.mockResolvedValue(3);
    await expect(svc.signupAvailable()).resolves.toBe(false);
  });

  it('logout revokes the token and records auth.logout', async () => {
    refreshTokens.revoke.mockResolvedValue('u1');
    await svc.logout('refresh');
    expect(refreshTokens.revoke).toHaveBeenCalledWith('refresh');
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: EVENT_TYPES.Logout,
        actorUserId: 'u1',
      }),
    );
  });

  it('refresh rotates the token and records auth.token_refreshed', async () => {
    refreshTokens.rotate.mockResolvedValue({
      userId: 'u1',
      token: 'refresh2',
      sessionId: 's1',
      activeRole: 'ADMIN',
    });
    users.findByIdWithAccess.mockResolvedValue(user);
    const result = await svc.refresh('refresh');
    expect(result.tokens.accessToken).toBe('access');
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: EVENT_TYPES.TokenRefreshed,
        actorUserId: 'u1',
      }),
    );
  });

  it('changePassword verifies the current password, updates, and revokes sessions', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'old' });
    passwords.verify.mockResolvedValue(true);
    passwords.hash.mockResolvedValue('newhash');
    await svc.changePassword('u1', 'current', 'next');
    expect(events.publish).toHaveBeenCalled();
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('changePassword rejects an incorrect current password', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'old' });
    passwords.verify.mockResolvedValue(false);
    await expect(
      svc.changePassword('u1', 'wrong', 'next'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  describe('password reset completion', () => {
    const tokenRow = (over: Record<string, unknown> = {}) => ({
      id: 'prt1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { isActive: true },
      ...over,
    });

    beforeEach(() => {
      prisma.passwordResetToken = { findUnique: jest.fn() };
    });

    it('completePasswordReset hashes, marks the token used, and revokes all sessions', async () => {
      const row = tokenRow();
      prisma.passwordResetToken.findUnique.mockResolvedValue(row);
      passwords.hash.mockResolvedValue('newhash');
      const tx = {
        user: { update: jest.fn() },
        passwordResetToken: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      txm.run = jest.fn(async (cb: (t: unknown) => unknown) => cb(tx));

      await svc.completePasswordReset('raw-token', 'new-password');

      expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'prt1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: 'newhash' },
      });
      expect(events.publish).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          type: EVENT_TYPES.PasswordResetCompleted,
          aggregateId: 'u1',
        }),
      );
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    });

    it('rejects the loser of two concurrent submits of the same link', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(tokenRow());
      passwords.hash.mockResolvedValue('newhash');
      // Another request claimed the token between the read and the update.
      const tx = {
        user: { update: jest.fn() },
        passwordResetToken: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      txm.run = jest.fn(async (cb: (t: unknown) => unknown) => cb(tx));

      await expect(
        svc.completePasswordReset('raw-token', 'new-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(events.publish).not.toHaveBeenCalled();
      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
      expect(security.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: EVENT_TYPES.PasswordResetRejected,
          entityId: 'u1',
        }),
      );
    });

    it('rejects an unknown token and records auth.password_reset_rejected', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      await expect(
        svc.completePasswordReset('bogus', 'new-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(security.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: EVENT_TYPES.PasswordResetRejected,
        }),
      );
      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(
        tokenRow({ expiresAt: new Date(Date.now() - 1) }),
      );
      await expect(
        svc.completePasswordReset('raw-token', 'new-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an already-used token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(
        tokenRow({ usedAt: new Date() }),
      );
      await expect(
        svc.completePasswordReset('raw-token', 'new-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token for a deactivated user', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(
        tokenRow({ user: { isActive: false } }),
      );
      await expect(
        svc.completePasswordReset('raw-token', 'new-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('validateResetToken answers live vs dead links without side effects', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(tokenRow());
      await expect(svc.validateResetToken('raw-token')).resolves.toBe(true);
      prisma.passwordResetToken.findUnique.mockResolvedValue(
        tokenRow({ usedAt: new Date() }),
      );
      await expect(svc.validateResetToken('raw-token')).resolves.toBe(false);
      expect(security.record).not.toHaveBeenCalled();
    });
  });

  it('switchRole rejects a role the user does not hold', async () => {
    users.findByIdWithAccess.mockResolvedValue(user);
    await expect(
      svc.switchRole('u1', 's1', 'SUPER_ADMIN'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('switchRole records auth.role_switched on success', async () => {
    users.findByIdWithAccess.mockResolvedValue(user);
    await svc.switchRole('u1', 's1', 'ADMIN');
    expect(refreshTokens.setSessionActiveRole).toHaveBeenCalledWith(
      's1',
      'ADMIN',
    );
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: EVENT_TYPES.RoleSwitched,
        actorUserId: 'u1',
        metadata: { role: 'ADMIN', sessionId: 's1' },
      }),
    );
  });

  it('switchRole refuses an add-on role even when the user holds it', async () => {
    users.findByIdWithAccess.mockResolvedValue({
      ...user,
      roles: ['STAFF', 'READ_ADMIN'],
    });
    await expect(
      svc.switchRole('u1', 's1', 'READ_ADMIN'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(refreshTokens.setSessionActiveRole).not.toHaveBeenCalled();
  });

  it('refresh drops a legacy add-on active role for the default role', async () => {
    refreshTokens.rotate.mockResolvedValue({
      userId: 'u1',
      token: 'refresh2',
      sessionId: 's1',
      activeRole: 'READ_ADMIN',
    });
    users.defaultRole = () => 'STAFF';
    users.findByIdWithAccess.mockResolvedValue({
      ...user,
      roles: ['STAFF', 'READ_ADMIN'],
    });
    const result = await svc.refresh('refresh');
    expect(result.user.activeRole).toBe('STAFF');
  });
});
