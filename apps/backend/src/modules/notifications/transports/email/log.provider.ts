import { Injectable, Logger } from '@nestjs/common';
import type { RenderedMessage } from '../../notification.types';
import type { EmailProvider } from './email-provider.interface';

/** Used when EMAIL is enabled but no provider is configured; logs instead of sending. */
@Injectable()
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log';
  readonly isConfigured = true;
  private readonly logger = new Logger('EmailLogProvider');

  send(message: RenderedMessage, from: string): Promise<void> {
    this.logger.log(
      `[email:log] from=${from} to=${message.to} subject="${message.subject ?? ''}" ` +
        `(no email provider configured — not actually sent)`,
    );
    return Promise.resolve();
  }
}
