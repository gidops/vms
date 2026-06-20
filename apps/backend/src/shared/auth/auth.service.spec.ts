import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
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
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
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
});
