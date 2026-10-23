import { Injectable, Logger } from '@nestjs/common';
import type { RenderedMessage } from '../../notification.types';
import type { WhatsappProvider } from './whatsapp-provider.interface';

/**
 * Fallback WhatsApp provider used when WHATSAPP is enabled but the chosen
 * backend isn't configured (e.g. bare local dev). Logs instead of sending so the
 * pipeline still works end-to-end without crashing.
 */
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
