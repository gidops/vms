import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, NotificationChannel } from '@prisma/client';
import type { Env } from '../../shared/config/env.schema';
import {
  generateResetToken,
  RESET_RESEND_COOLDOWN_MS,
  RESET_TOKEN_TTL_MS,
} from '../../shared/auth/reset-token.util';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { NOTIFICATION_TEMPLATES } from '../notifications/notification.types';

/**
 * Admin-triggered password reset. The admin never sees or sets a password:
 * the user gets a single-use link (15 min) and chooses their own. Completion
 * lives in AuthService (`auth/reset-password`), next to the other public
 * credential flows.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async requestReset(
    targetUserId: string,
    actorUserId: string,
  ): Promise<{ expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.authProvider !== AuthProvider.LOCAL) {
      throw new BadRequestException(
        'This account signs in through SSO and has no local password',
      );
    }
    if (!user.isActive) {
      throw new BadRequestException(
        'This account is deactivated; reactivate it before resetting the password',
      );
    }
    // Checked up front so no orphaned-but-valid token is left behind.
    if (!this.config.get('EMAIL_ENABLED', { infer: true })) {
      throw new ServiceUnavailableException(
        'Email delivery is disabled, so the reset link cannot be sent',
      );
    }
    // Every send supersedes the last link and emails afresh, so repeated
    // clicks only spam the inbox: enforce a short gap between sends.
    const recent = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        createdAt: { gt: new Date(Date.now() - RESET_RESEND_COOLDOWN_MS) },
      },
    });
    if (recent) {
      throw new HttpException(
        'A reset link was just sent to this user — wait a minute before sending another',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const { token, hash } = generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.txm.run(async (tx) => {
      // One live link per user: a new request supersedes any outstanding one.
      await tx.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hash,
          expiresAt,
          createdById: actorUserId,
        },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.PasswordResetRequested,
        aggregateType: 'User',
        aggregateId: user.id,
        payload: { expiresAt: expiresAt.toISOString() },
        metadata: { actorUserId },
      });
    });

    const appUrl = this.config.get('APP_PUBLIC_URL', { infer: true });
    const queued = await this.notifications.enqueue({
      templateKey: NOTIFICATION_TEMPLATES.PASSWORD_RESET,
      locale: user.preferredLocale,
      data: {
        userName: user.fullName,
        resetUrl: `${appUrl}/reset-password?token=${token}`,
        expiresMinutes: Math.round(RESET_TOKEN_TTL_MS / 60_000),
      },
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          recipient: user.email,
          userId: user.id,
        },
      ],
    });
    if (queued === 0) {
      // Nothing will ever deliver this link; don't leave a live token behind.
      await this.prisma.passwordResetToken.deleteMany({
        where: { tokenHash: hash },
      });
      throw new ServiceUnavailableException(
        'The reset email could not be queued',
      );
    }
    return { expiresAt };
  }
}
