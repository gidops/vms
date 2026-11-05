import { Injectable, Logger } from '@nestjs/common';
import type { RenderedMessage } from '../../notification.types';
import type { WhatsappProvider } from './whatsapp-provider.interface';

/** Used when WHATSAPP is enabled but no backend is configured; logs instead of sending. */
@Injectable()
export class LogWhatsappProvider implements WhatsappProvider {
  readonly name = 'log';
  readonly isConfigured = true;
  private readonly logger = new Logger('WhatsappLogProvider');

  send(message: RenderedMessage): Promise<void> {
    this.logger.log(
      `[whatsapp:log] to=${message.to} body="${message.text ?? ''}" ` +
        `(no WhatsApp provider configured — not actually sent)`,
    );
    return Promise.resolve();
  }
}
