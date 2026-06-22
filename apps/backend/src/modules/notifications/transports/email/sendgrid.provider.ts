import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import type { EmailProvider } from './email-provider.interface';

/** SendGrid email provider (HTTP API). Configured via SENDGRID_API_KEY. */
@Injectable()
export class SendgridProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private readonly logger = new Logger(SendgridProvider.name);
  private readonly apiKey?: string;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('SENDGRID_API_KEY', { infer: true });
    if (this.apiKey) sgMail.setApiKey(this.apiKey);
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async send(message: RenderedMessage, from: string): Promise<void> {
    await sgMail.send({
      to: message.to,
      from,
      subject: message.subject ?? '',
      html: message.html,
      text: message.text ?? ' ',
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
        type: a.contentType,
        disposition: a.cid ? 'inline' : 'attachment',
        content_id: a.cid,
      })),
    });
    this.logger.debug(`Sent email to ${message.to} via SendGrid`);
  }
}
