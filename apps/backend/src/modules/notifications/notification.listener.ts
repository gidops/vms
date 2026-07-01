import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../shared/config/env.schema';
import { EncryptionService } from '../../shared/crypto/encryption.service';
import type { DomainEvent } from '../../shared/events/domain-event';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { I18nService, type Locale } from '../../shared/i18n/i18n.service';
import { NotificationService } from './notification.service';
import {
  NOTIFICATION_TEMPLATES,
  type ChannelTarget,
} from './notification.types';

/** Format a date as DD-MM-YYYY (matches the visitor-facing email convention). */
function formatDate(d?: Date | null): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Format a time as HH:mm. */
function formatTime(d?: Date | null): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Turns visitor-lifecycle domain events into notifications. It resolves the
 * recipients, their locale, and the channel set, then enqueues — the dispatcher
 * renders and delivers. Listeners never call transports directly.
 */
@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly encryption: EncryptionService,
    private readonly i18n: I18nService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Visitor's preferred locale may be encrypted-free enum; normalize safely. */
  private localeFrom(
    value: string | null | undefined,
    event: DomainEvent,
  ): Locale {
    return this.i18n.resolveLocale(value ?? event.metadata?.locale);
  }

  /** Visitor PII (phone) is stored encrypted; tolerate plaintext/legacy values. */
  private safeDecrypt(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
      return this.encryption.decrypt(value);
    } catch {
      return value;
    }
  }

  @OnEvent(EVENT_TYPES.VisitApproved)
  async onVisitApproved(event: DomainEvent): Promise<void> {
    const visit = await this.prisma.visit.findUnique({
      where: { id: event.aggregateId },
      include: { visitor: true, host: { include: { user: true } }, pass: true },
    });
    if (!visit) return;
    // Walk-ins are auto-approved and start at the VMC — they carry no invite QR
    // and get no approval email; the badge is assigned in person at check-in.
    if (visit.type === 'WALK_IN') return;

    const locale = this.localeFrom(visit.visitor.preferredLocale, event);
    const phone = this.safeDecrypt(visit.visitor.phone);
    const data = {
      visitorName: visit.visitor.fullName,
      host: visit.host?.user.fullName ?? '',
      visitDate: formatDate(visit.scheduledAt),
      time: formatTime(visit.scheduledAt),
      purpose: visit.purpose,
      // The guest-facing invite code (encoded in the QR). Falls back to the
      // internal pass code if a reference code was somehow not generated.
      code: visit.referenceCode ?? visit.pass?.code ?? '',
    };

    const channels: ChannelTarget[] = [
      {
        channel: NotificationChannel.EMAIL,
        recipient: visit.visitor.email,
        visitorEmail: visit.visitor.email,
      },
      { channel: NotificationChannel.SMS, recipient: phone },
      { channel: NotificationChannel.WHATSAPP, recipient: phone },
      { channel: NotificationChannel.IN_APP, userId: visit.host?.userId },
    ];

    await this.enqueue(
      NOTIFICATION_TEMPLATES.VISIT_APPROVED,
      locale,
      visit.id,
      data,
      channels,
    );
  }

  @OnEvent(EVENT_TYPES.VisitorCheckedIn)
  async onVisitorCheckedIn(event: DomainEvent): Promise<void> {
    const visit = await this.prisma.visit.findUnique({
      where: { id: event.aggregateId },
      include: { visitor: true, host: { include: { user: true } } },
    });
    if (!visit) return;
    // No named host (e.g. a walk-in) → there is nobody to notify of the arrival.
    if (!visit.host) return;

    // Notify the HOST that their guest has arrived (host's preferred locale).
    const locale = this.localeFrom(visit.host.user.preferredLocale, event);
    const data = {
      visitorName: visit.visitor.fullName,
      hostName: visit.host.user.fullName,
      time: formatTime(visit.checkInAt ?? new Date()),
    };
    const channels: ChannelTarget[] = [
      { channel: NotificationChannel.EMAIL, recipient: visit.host.user.email },
      { channel: NotificationChannel.SMS, recipient: visit.host.user.phone },
      {
        channel: NotificationChannel.WHATSAPP,
        recipient: visit.host.user.phone,
      },
      { channel: NotificationChannel.IN_APP, userId: visit.host.userId },
    ];

    await this.enqueue(
      NOTIFICATION_TEMPLATES.VISITOR_ARRIVED,
      locale,
      visit.id,
      data,
      channels,
    );
  }

  @OnEvent(EVENT_TYPES.VisitorCheckedOut)
  async onVisitorCheckedOut(event: DomainEvent): Promise<void> {
    const visit = await this.prisma.visit.findUnique({
      where: { id: event.aggregateId },
      include: { visitor: true, host: { include: { user: true } } },
    });
    if (!visit) return;

    const locale = this.localeFrom(visit.visitor.preferredLocale, event);
    const phone = this.safeDecrypt(visit.visitor.phone);
    const appUrl = this.config.get('APP_PUBLIC_URL', { infer: true });
    const data = {
      visitorName: visit.visitor.fullName,
      ratingUrl: `${appUrl}/rating/${visit.id}`,
    };
    const channels: ChannelTarget[] = [
      {
        channel: NotificationChannel.EMAIL,
        recipient: visit.visitor.email,
        visitorEmail: visit.visitor.email,
      },
      { channel: NotificationChannel.SMS, recipient: phone },
      { channel: NotificationChannel.WHATSAPP, recipient: phone },
      { channel: NotificationChannel.IN_APP, userId: visit.host?.userId },
    ];

    await this.enqueue(
      NOTIFICATION_TEMPLATES.VISIT_THANK_YOU,
      locale,
      visit.id,
      data,
      channels,
    );
  }

  private async enqueue(
    templateKey: (typeof NOTIFICATION_TEMPLATES)[keyof typeof NOTIFICATION_TEMPLATES],
    locale: Locale,
    visitId: string,
    data: Record<string, unknown>,
    channels: ChannelTarget[],
  ): Promise<void> {
    try {
      await this.notifications.enqueue({
        templateKey,
        locale,
        visitId,
        data,
        channels,
      });
    } catch (err) {
      // Never let a notification failure break the event pipeline.
      this.logger.error(
        `Failed to enqueue ${templateKey} for visit ${visitId}: ${(err as Error).message}`,
      );
    }
  }
}
