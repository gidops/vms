import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import { normalizeE164 } from '../phone';
import { TwilioClientProvider } from '../twilio.client';
import type { WhatsappProvider } from './whatsapp-provider.interface';

/** Ensure a number is in Twilio's `whatsapp:+E164` form. */
function toWhatsApp(value: string): string {
  if (value.startsWith('whatsapp:')) return value;
  return `whatsapp:${normalizeE164(value)}`;
}

/** Map ordered variables to Twilio Content positional variables ({"1": …}). */
function toContentVariables(variables: string[]): Record<string, string> {
  return Object.fromEntries(variables.map((v, i) => [String(i + 1), v]));
}

/**
 * WhatsApp via Twilio (BSP). Reuses the shared Twilio account/client that also
 * powers SMS. Sends an approved Content template when the message carries one,
 * otherwise free-form text. Logs (no-op) when Twilio isn't configured.
 */
@Injectable()
export class TwilioWhatsappProvider implements WhatsappProvider {
  readonly name = 'twilio';
  private readonly logger = new Logger(TwilioWhatsappProvider.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly twilio: TwilioClientProvider,
  ) {}

  get isConfigured(): boolean {
    return (
      this.twilio.isConfigured &&
      Boolean(this.config.get('TWILIO_WHATSAPP_FROM', { infer: true }))
    );
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
    const base = { from: toWhatsApp(from), to: toWhatsApp(message.to ?? '') };
    if (message.template) {
      await client.messages.create({
        ...base,
        contentSid: message.template.name,
        contentVariables: JSON.stringify(
          toContentVariables(message.template.variables),
        ),
      });
    } else {
      await client.messages.create({ ...base, body: message.text ?? '' });
    }
    this.logger.debug(`Sent WhatsApp to ${message.to} via Twilio`);
  }
}
