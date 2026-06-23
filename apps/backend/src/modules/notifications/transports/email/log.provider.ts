import { Injectable, Logger } from '@nestjs/common';
import type { RenderedMessage } from '../../notification.types';
import type { EmailProvider } from './email-provider.interface';

/**
 * Fallback email provider used when EMAIL is enabled but no real provider is
 * configured (e.g. bare local dev). Logs the message instead of sending so the
 * pipeline still works end-to-end without crashing.
 */
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
