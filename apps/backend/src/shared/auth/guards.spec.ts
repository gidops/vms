import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityAuditService } from '../audit/security-audit.service';
import { ANY_PERMISSIONS_KEY } from './auth.decorators';
import { JwtAuthGuard, PermissionsGuard } from './guards';

function context(user: unknown): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user, method: 'GET', url: '/x' }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let security: { record: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: PermissionsGuard;

  beforeEach(() => {
    security = { record: jest.fn().mockResolvedValue(undefined) };
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      security as unknown as SecurityAuditService,
    );
  });

  it('allows when no permissions are required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(context({}))).resolves.toBe(true);
  });

  it('allows when the user holds all required permissions', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ANY_PERMISSIONS_KEY ? undefined : ['visit:approve'],
    );
    await expect(
      guard.canActivate(
        context({ userId: 'u', permissions: ['visit:approve'] }),
      ),
    ).resolves.toBe(true);
    expect(security.record).not.toHaveBeenCalled();
  });

  it('allows any-of routes when the user holds one of the permissions', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ANY_PERMISSIONS_KEY
        ? ['history:read', 'insights:self']
        : undefined,
    );
    await expect(
      guard.canActivate(
        context({ userId: 'u', permissions: ['insights:self'] }),
      ),
    ).resolves.toBe(true);
  });

  it('denies and audits any-of routes when the user holds none', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ANY_PERMISSIONS_KEY
        ? ['history:read', 'insights:self']
        : undefined,
    );
    await expect(
      guard.canActivate(context({ userId: 'u', permissions: ['visit:read'] })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          anyOf: ['history:read', 'insights:self'],
        }),
      }),
    );
  });

  it('denies and audits when a required permission is missing', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ANY_PERMISSIONS_KEY ? undefined : ['visit:approve'],
    );
    await expect(
      guard.canActivate(context({ userId: 'u', permissions: [] })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'authz.permission_denied',
        actorUserId: 'u',
        metadata: expect.objectContaining({ required: ['visit:approve'] }),
      }),
    );
  });
});

describe('JwtAuthGuard', () => {
  it('bypasses authentication for @Public routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const ctx = {
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
