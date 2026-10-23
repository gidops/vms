import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import { normalizeE164 } from '../phone';
import type { NotificationTransport } from '../transport.interface';
import { TwilioClientProvider } from '../twilio.client';

/** SMS channel via Twilio. Logs (no-op) when Twilio isn't configured. */
@Injectable()
export class SmsTransport implements NotificationTransport {
  readonly channel = NotificationChannel.SMS;
  private readonly logger = new Logger(SmsTransport.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly twilio: TwilioClientProvider,
  ) {}

  isEnabled(): boolean {
    return this.config.get('SMS_ENABLED', { infer: true });
  }

  async send(message: RenderedMessage): Promise<void> {
    const client = this.twilio.getClient();
    const from = this.config.get('TWILIO_SMS_FROM', { infer: true });
    if (!client || !from) {
      this.logger.log(
        `[sms:log] to=${message.to} body="${message.text ?? ''}" ` +
          `(Twilio SMS not configured — not actually sent)`,
      );
      return;
    }
    await client.messages.create({
      from,
      to: normalizeE164(message.to),
      body: message.text ?? '',
    });
    this.logger.debug(`Sent SMS to ${message.to}`);
  }
}
