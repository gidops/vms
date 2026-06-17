import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityAuditService } from '../audit/security-audit.service';
import { EVENT_TYPES } from '../events/domain-event';
import { TokenService } from './token.service';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly security: SecurityAuditService,
  ) {}

  /** Create a session + first refresh token (within the caller's transaction). */
  async issueForNewSession(
    tx: Prisma.TransactionClient,
    userId: string,
    ctx: { ip?: string; userAgent?: string; activeRole?: string | null },
  ): Promise<{ token: string; sessionId: string }> {
    const session = await tx.session.create({
      data: {
        userId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        activeRole: ctx.activeRole ?? null,
      },
    });
    const { token, hash } = this.tokens.generateRefreshToken();
    await tx.refreshToken.create({
      data: {
        sessionId: session.id,
        userId,
        tokenHash: hash,
        family: randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return { token, sessionId: session.id };
  }

  /** Rotate a refresh token; detect reuse of an already-used token. */
  async rotate(rawToken: string): Promise<{
    userId: string;
    token: string;
    sessionId: string;
    activeRole: string | null;
  }> {
    const tokenHash = this.tokens.hashRefreshToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: { select: { activeRole: true } } },
    });
    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (existing.usedAt) {
      // A used token presented again ⇒ likely theft. Revoke the whole family.
      await this.prisma.refreshToken.updateMany({
        where: { family: existing.family },
        data: { revokedAt: new Date() },
      });
      // High-severity security signal — surface it in the audit trail + Seq.
      await this.security.record({
        action: EVENT_TYPES.RefreshReuseDetected,
        entityType: 'Session',
        entityId: existing.sessionId,
        actorUserId: existing.userId,
        level: 'Error',
        metadata: { family: existing.family },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return this.prisma.$transaction(async (tx) => {
      const { token, hash } = this.tokens.generateRefreshToken();
      const created = await tx.refreshToken.create({
        data: {
          sessionId: existing.sessionId,
          userId: existing.userId,
          tokenHash: hash,
          family: existing.family,
          prevTokenId: existing.id,
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        },
      });
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { usedAt: new Date(), replacedById: created.id },
      });
      return {
        userId: existing.userId,
        token,
        sessionId: existing.sessionId,
        activeRole: existing.session.activeRole,
      };
    });
  }

  /** Revoke every session + refresh token for a user (e.g. after a password change). */
  async revokeAllForUser(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  /** Update the active role stored on a session (called by switch-role). */
  async setSessionActiveRole(sessionId: string, role: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { activeRole: role },
    });
  }

  /**
   * Revoke the family + session behind a refresh token (logout). Returns the
   * owning user id (or null if the token is unknown) so the caller can audit it.
   */
  async revoke(rawToken: string): Promise<string | null> {
    const tokenHash = this.tokens.hashRefreshToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!existing) return null;
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { family: existing.family },
        data: { revokedAt: new Date() },
      }),
      this.prisma.session.update({
        where: { id: existing.sessionId },
        data: { revokedAt: new Date() },
      }),
    ]);
    return existing.userId;
  }
}
