import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import type { NotificationTransport } from '../transport.interface';
import { TwilioClientProvider } from '../twilio.client';

/** Ensure a number is in Twilio's `whatsapp:+E164` form. */
function toWhatsApp(value: string): string {
  return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;
}

/** WhatsApp channel via Twilio. Logs (no-op) when Twilio isn't configured. */
@Injectable()
export class WhatsappTransport implements NotificationTransport {
  readonly channel = NotificationChannel.WHATSAPP;
  private readonly logger = new Logger(WhatsappTransport.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly twilio: TwilioClientProvider,
  ) {}

  isEnabled(): boolean {
    return this.config.get('WHATSAPP_ENABLED', { infer: true });
  }

  async send(message: RenderedMessage): Promise<void> {
    const client = this.twilio.getClient();
    const from = this.config.get('TWILIO_WHATSAPP_FROM', { infer: true });
    if (!client || !from) {
      this.logger.log(
        `[whatsapp:log] to=${message.to} body="${message.text ?? ''}" ` +
          `(Twilio WhatsApp not configured — not actually sent)`,
      );
      return;
    }
    await client.messages.create({
      from: toWhatsApp(from),
      to: toWhatsApp(message.to ?? ''),
      body: message.text ?? '',
    });
    this.logger.debug(`Sent WhatsApp to ${message.to}`);
  }
}
