import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import type { NotificationTransport } from '../transport.interface';
import type { EmailProvider } from './email-provider.interface';
import { LogEmailProvider } from './log.provider';
import { SendgridProvider } from './sendgrid.provider';
import { SmtpProvider } from './smtp.provider';

/**
 * Email channel. Selects a provider by EMAIL_PROVIDER, falling back to a log
 * provider when the chosen one isn't configured, so enabling EMAIL never breaks
 * boot or the request path.
 */
@Injectable()
export class EmailTransport implements NotificationTransport {
  readonly channel = NotificationChannel.EMAIL;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly smtp: SmtpProvider,
    private readonly sendgrid: SendgridProvider,
    private readonly log: LogEmailProvider,
  ) {}

  isEnabled(): boolean {
    return this.config.get('EMAIL_ENABLED', { infer: true });
  }

  private provider(): EmailProvider {
    const chosen = this.config.get('EMAIL_PROVIDER', { infer: true });
    if (chosen === 'sendgrid' && this.sendgrid.isConfigured) {
      return this.sendgrid;
    }
    if (chosen === 'smtp' && this.smtp.isConfigured) {
      return this.smtp;
    }
    return this.log;
  }

  private from(): string {
    return (
      this.config.get('EMAIL_FROM', { infer: true }) ??
      this.config.get('SMTP_USER', { infer: true }) ??
      'no-reply@aatc.org'
    );
  }

  async send(message: RenderedMessage): Promise<void> {
    await this.provider().send(message, this.from());
  }
}
