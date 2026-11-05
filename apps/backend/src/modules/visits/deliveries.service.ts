import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { PERMISSIONS, type NotificationDelivery } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/auth/auth.decorators';
import { maskEmail, maskPhone } from '../../shared/common/mask';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { NotificationService } from '../notifications/notification.service';

const OUTBOUND = ['EMAIL', 'SMS', 'WHATSAPP'] as const;

function maskRecipient(
  channel: string,
  recipient: string | null,
): string | null {
  if (!recipient) return null;
  return channel === 'EMAIL' ? maskEmail(recipient) : maskPhone(recipient);
}

function canSeeDeliveryErrors(principal: AuthUser): boolean {
  return principal.permissions.includes(PERMISSIONS.NOTIFICATION_READ_ERRORS);
}

function toDelivery(
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

/** "SENT" means the provider accepted it; real delivery receipts would need provider webhooks. */
@Injectable()
export class VisitDeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly notifications: NotificationService,
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
      const n = await this.notifications.requeueFailed(tx, row.id);
      if (!n) throw new ConflictException('errors.notification.notRetryable');
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
