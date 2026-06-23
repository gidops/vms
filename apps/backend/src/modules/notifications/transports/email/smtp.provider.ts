import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import type { EmailProvider } from './email-provider.interface';

/**
 * SMTP email provider (nodemailer). Works with Gmail (app password), Mailtrap,
 * or any SMTP server — just point the SMTP_* env vars at it. The transporter is
 * created lazily on first send and reused.
 */
@Injectable()
export class SmtpProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpProvider.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService<Env, true>) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get('SMTP_HOST', { infer: true }));
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const user = this.config.get('SMTP_USER', { infer: true });
    const pass = this.config.get('SMTP_PASS', { infer: true });
    this.transporter = createTransport({
      host: this.config.get('SMTP_HOST', { infer: true }),
      port: this.config.get('SMTP_PORT', { infer: true }),
      secure: this.config.get('SMTP_SECURE', { infer: true }),
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  async send(message: RenderedMessage, from: string): Promise<void> {
    await this.getTransporter().sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        cid: a.cid,
        contentType: a.contentType,
      })),
    });
    this.logger.debug(`Sent email to ${message.to} via SMTP`);
  }
}
