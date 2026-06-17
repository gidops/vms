import { UnauthorizedException } from '@nestjs/common';
import { SecurityAuditService } from '../audit/security-audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshTokenService } from './refresh.service';
import { TokenService } from './token.service';

describe('RefreshTokenService', () => {
  let prisma: {
    refreshToken: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    session: { update: jest.Mock };
    $transaction: jest.Mock;
  };
  let tokens: { hashRefreshToken: jest.Mock; generateRefreshToken: jest.Mock };
  let security: { record: jest.Mock };
  let svc: RefreshTokenService;

  beforeEach(() => {
    prisma = {
      refreshToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
        update: jest.fn(),
      },
      session: { update: jest.fn() },
      $transaction: jest.fn(),
    };
    tokens = {
      hashRefreshToken: jest.fn((t: string) => `hash:${t}`),
      generateRefreshToken: jest.fn(() => ({ token: 'new', hash: 'newhash' })),
    };
    security = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new RefreshTokenService(
      prisma as unknown as PrismaService,
      tokens as unknown as TokenService,
      security as unknown as SecurityAuditService,
    );
  });

  it('rejects an unknown token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(svc.rotate('x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('detects reuse, revokes the whole family, and records a security event', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 't1',
      family: 'fam',
      sessionId: 's1',
      userId: 'u1',
      usedAt: new Date(),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10_000),
      session: { activeRole: 'ADMIN' },
    });

    await expect(svc.rotate('x')).rejects.toThrow(
      'Refresh token reuse detected',
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { family: 'fam' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.refresh_reuse_detected',
        level: 'Error',
        actorUserId: 'u1',
      }),
    );
  });

  it('rotates a valid token inside a transaction', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 't1',
      family: 'fam',
      sessionId: 's1',
      userId: 'u1',
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10_000),
      session: { activeRole: 'ADMIN' },
    });
    const tx = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 't2' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation(
      async (cb: (t: typeof tx) => unknown) => cb(tx),
    );

    const result = await svc.rotate('x');
    expect(result).toEqual({
      userId: 'u1',
      token: 'new',
      sessionId: 's1',
      activeRole: 'ADMIN',
    });
    expect(tx.refreshToken.create).toHaveBeenCalled();
    expect(tx.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' } }),
    );
  });

  it('revoke returns the owning user id and revokes the family + session', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 't1',
      family: 'fam',
      sessionId: 's1',
      userId: 'u1',
    });
    prisma.$transaction.mockResolvedValue([]);
    await expect(svc.revoke('x')).resolves.toBe('u1');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('revoke returns null for an unknown token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(svc.revoke('x')).resolves.toBeNull();
  });
});
