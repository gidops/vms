import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import type { EmailProvider } from './email-provider.interface';

interface SmtpConfig {
  profile: string;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

/** Serves smtp, gmail and mailtrap; all credentials coexist in env and EMAIL_PROVIDER picks one at boot. */
@Injectable()
export class SmtpProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpProvider.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private resolveConfig(): SmtpConfig {
    const provider = this.config.get('EMAIL_PROVIDER', { infer: true });
    switch (provider) {
      case 'gmail':
        return {
          profile: 'gmail',
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          user: this.config.get('GMAIL_USER', { infer: true }),
          pass: this.config.get('GMAIL_APP_PASSWORD', { infer: true }),
        };
      case 'mailtrap':
        return {
          profile: 'mailtrap',
          host: this.config.get('MAILTRAP_HOST', { infer: true }),
          port: this.config.get('MAILTRAP_PORT', { infer: true }),
          secure: false,
          user: this.config.get('MAILTRAP_USER', { infer: true }),
          pass: this.config.get('MAILTRAP_PASS', { infer: true }),
        };
      default:
        return {
          profile: 'smtp',
          host: this.config.get('SMTP_HOST', { infer: true }),
          port: this.config.get('SMTP_PORT', { infer: true }),
          secure: this.config.get('SMTP_SECURE', { infer: true }),
          user: this.config.get('SMTP_USER', { infer: true }),
          pass: this.config.get('SMTP_PASS', { infer: true }),
        };
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.resolveConfig().host);
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const { host, port, secure, user, pass } = this.resolveConfig();
    this.transporter = createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  async send(message: RenderedMessage, from: string): Promise<void> {
    const { profile } = this.resolveConfig();
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
    this.logger.debug(`Sent email to ${message.to} via SMTP (${profile})`);
  }
}
