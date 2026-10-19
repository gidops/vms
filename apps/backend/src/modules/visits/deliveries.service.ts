import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { ROLES, type NotificationDelivery } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/auth/auth.decorators';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';

const OUTBOUND = ['EMAIL', 'SMS', 'WHATSAPP'] as const;

/** `jane@x.com` → `j***@x.com`. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/** `+2348031184420` → `+234 ***420`. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\s+/g, '');
  if (digits.length <= 6) return '***';
  return `${digits.slice(0, 4)} ***${digits.slice(-3)}`;
}

export function maskRecipient(
  channel: string,
  recipient: string | null,
): string | null {
  if (!recipient) return null;
  return channel === 'EMAIL' ? maskEmail(recipient) : maskPhone(recipient);
}

/** Raw provider errors are only shown to Security Manager / System Admin. */
export function canSeeDeliveryErrors(principal: AuthUser): boolean {
  return (
    principal.activeRole === ROLES.ADMIN ||
    principal.activeRole === ROLES.SUPER_ADMIN
  );
}

export function toDelivery(
  n: Notification,
  revealErrors: boolean,
): NotificationDelivery {
  return {
    id: n.id,
    channel: n.channel as NotificationDelivery['channel'],
    templateKey: n.templateKey,
    recipientMasked: maskRecipient(n.channel, n.recipient),
    status: (['PENDING', 'SENT', 'FAILED'].includes(n.status)
      ? n.status
      : 'PENDING') as NotificationDelivery['status'],
    attempts: n.attempts,
    error: revealErrors ? n.error : null,
    sentAt: n.sentAt,
    createdAt: n.createdAt,
  };
}

/**
 * Per-visit delivery status of the email / SMS / WhatsApp messages the
 * notifications pipeline queued. "SENT" means the provider accepted the
 * message; real delivery receipts need provider webhooks (not built).
 */
@Injectable()
export class VisitDeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  async list(
    visitId: string,
    principal: AuthUser,
  ): Promise<NotificationDelivery[]> {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      select: { id: true },
    });
    if (!visit) throw new NotFoundException('errors.visit.notFound');
    const rows = await this.prisma.notification.findMany({
      where: { visitId, channel: { in: [...OUTBOUND] } },
      orderBy: { createdAt: 'asc' },
    });
    const reveal = canSeeDeliveryErrors(principal);
    return rows.map((n) => toDelivery(n, reveal));
  }

  /**
   * Re-queue a FAILED message: back to PENDING with a fresh attempt budget so
   * the dispatcher picks it up on its next poll.
   */
  async retry(
    visitId: string,
    notificationId: string,
    principal: AuthUser,
  ): Promise<NotificationDelivery> {
    const row = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        visitId,
        channel: { in: [...OUTBOUND] },
      },
    });
    if (!row) throw new NotFoundException('errors.notification.notFound');
    if (row.status !== 'FAILED') {
      throw new BadRequestException('errors.notification.notRetryable');
    }
    const updated = await this.txm.run(async (tx) => {
      const n = await tx.notification.update({
        where: { id: row.id },
        data: {
          status: 'PENDING',
          attempts: 0,
          availableAt: new Date(),
          error: null,
        },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.NotificationRetried,
        aggregateType: 'Visit',
        aggregateId: visitId,
        payload: {
          visitId,
          notificationId: row.id,
          channel: row.channel,
          templateKey: row.templateKey,
        },
        metadata: { actorUserId: principal.userId },
      });
      return n;
    });
    return toDelivery(updated, canSeeDeliveryErrors(principal));
  }
}
