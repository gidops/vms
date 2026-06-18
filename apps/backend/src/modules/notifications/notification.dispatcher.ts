import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, type Notification } from '@prisma/client';
import type { Env } from '../../shared/config/env.schema';
import { I18nService } from '../../shared/i18n/i18n.service';
import { NotificationRepository } from './notification.repository';
import { TemplateService } from './templates/template.service';
import { ChannelRegistry } from './transports/channel.registry';

const BATCH_SIZE = 25;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

/**
 * Polls the Notification table and delivers PENDING rows via the channel's
 * transport — the same durable, at-least-once pattern as the outbox relay. Each
 * row is rendered for its locale at send time; failures back off exponentially
 * and are marked FAILED once attempts are exhausted. IN_APP rows have no
 * transport: rendering their localized title/body into the payload IS delivery.
 */
@Injectable()
export class NotificationDispatcher
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDispatcher.name);
  private timer?: NodeJS.Timeout;
  private draining = false;

  constructor(
    private readonly repo: NotificationRepository,
    private readonly templates: TemplateService,
    private readonly registry: ChannelRegistry,
    private readonly i18n: I18nService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    const interval = this.config.get('NOTIFICATION_POLL_INTERVAL_MS', {
      infer: true,
    });
    this.timer = setInterval(() => void this.drain(), interval);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const rows = await this.repo.fetchPending(BATCH_SIZE);
      for (const row of rows) {
        await this.deliver(row);
      }
    } catch (err) {
      this.logger.error('Notification drain failed', err as Error);
    } finally {
      this.draining = false;
    }
  }

  private async deliver(row: Notification): Promise<void> {
    const maxAttempts = this.config.get('NOTIFICATION_MAX_ATTEMPTS', {
      infer: true,
    });
    try {
      const locale = this.i18n.resolveLocale(row.locale);
      const data = (row.payload as Record<string, unknown> | null) ?? {};
      const rendered = await this.templates.render(
        row.templateKey,
        row.channel,
        locale,
        data,
      );

      if (row.channel === NotificationChannel.IN_APP) {
        // The row itself is the delivery; persist the rendered title/body.
        await this.repo.markSent(row.id, {
          ...data,
          title: rendered.subject,
          body: rendered.text,
        });
        return;
      }

      const transport = this.registry.get(row.channel);
      if (!transport) {
        throw new Error(`No transport registered for ${row.channel}`);
      }
      if (!transport.isEnabled()) {
        throw new Error(`Channel ${row.channel} is disabled`);
      }
      await transport.send({ ...rendered, to: row.recipient ?? undefined });
      await this.repo.markSent(row.id);
    } catch (err) {
      const nextAttempt = row.attempts + 1;
      const exhausted = nextAttempt >= maxAttempts;
      const backoff = Math.min(
        BASE_BACKOFF_MS * 2 ** row.attempts,
        MAX_BACKOFF_MS,
      );
      const message = (err as Error).message;
      this.logger[exhausted ? 'error' : 'warn'](
        `Notification ${row.id} (${row.channel}/${row.templateKey}) failed ` +
          `attempt ${nextAttempt}/${maxAttempts}: ${message}`,
      );
      await this.repo.markFailed(row.id, backoff, message, exhausted);
    }
  }
}
