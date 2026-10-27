import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, Prisma, type Notification } from '@prisma/client';
import type {
  NotificationItem,
  NotificationQuery,
  Paginated,
} from '@vms/contracts';
import type { Env } from '../../shared/config/env.schema';
import type { ChannelTarget, EnqueueSpec } from './notification.types';
import { NotificationRepository } from './notification.repository';

const TOGGLE: Record<NotificationChannel, keyof Env> = {
  EMAIL: 'EMAIL_ENABLED',
  SMS: 'SMS_ENABLED',
  WHATSAPP: 'WHATSAPP_ENABLED',
  IN_APP: 'INAPP_ENABLED',
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly repo: NotificationRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private channelEnabled(channel: NotificationChannel): boolean {
    return this.config.get(TOGGLE[channel], { infer: true });
  }

  private deliverable(t: ChannelTarget): boolean {
    if (!this.channelEnabled(t.channel)) return false;
    if (t.channel === NotificationChannel.IN_APP) return Boolean(t.userId);
    return Boolean(t.recipient);
  }

  async enqueue(spec: EnqueueSpec): Promise<number> {
    const rows: Prisma.NotificationCreateManyInput[] = spec.channels
      .filter((t) => this.deliverable(t))
      .map((t) => ({
        channel: t.channel,
        locale: spec.locale,
        templateKey: spec.templateKey,
        payload: spec.data as Prisma.InputJsonValue,
        visitId: spec.visitId ?? null,
        userId: t.userId ?? null,
        visitorEmail: t.visitorEmail ?? null,
        recipient:
          t.channel === NotificationChannel.IN_APP
            ? null
            : (t.recipient ?? null),
        status: 'PENDING',
      }));

    if (rows.length === 0) {
      this.logger.debug(
        `No deliverable channels for ${spec.templateKey} (toggles/recipients)`,
      );
      return 0;
    }
    const res = await this.repo.createMany(rows);
    return res.count;
  }

  async list(
    userId: string,
    query: NotificationQuery,
  ): Promise<Paginated<NotificationItem>> {
    const [rows, total] = await this.repo.listForUser(userId, {
      page: query.page,
      pageSize: query.pageSize,
      unreadOnly: query.unreadOnly,
    });
    return {
      items: rows.map((r) => this.toItem(r)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async markRead(userId: string, id: string): Promise<{ id: string }> {
    const res = await this.repo.markRead(id, userId);
    if (res.count === 0)
      throw new NotFoundException('errors.notification.notFound');
    return { id };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    return { updated: await this.repo.markAllRead(userId) };
  }

  private toItem(row: Notification): NotificationItem {
    return {
      id: row.id,
      channel: row.channel,
      locale: row.locale,
      templateKey: row.templateKey,
      data: (row.payload as Record<string, unknown> | null) ?? null,
      readAt: row.readAt,
      visitId: row.visitId,
      createdAt: row.createdAt,
    };
  }
}
