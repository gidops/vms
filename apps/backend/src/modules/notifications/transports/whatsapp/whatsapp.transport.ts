import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import type { NotificationTransport } from '../transport.interface';
import { LogWhatsappProvider } from './log.provider';
import { MetaCloudWhatsappProvider } from './meta.provider';
import { TwilioWhatsappProvider } from './twilio.provider';
import type { WhatsappProvider } from './whatsapp-provider.interface';

/**
 * WhatsApp channel. Selects a provider by WHATSAPP_PROVIDER (twilio | meta),
 * falling back to a log provider when the chosen one isn't configured, so
 * enabling WHATSAPP never breaks boot. Approved templates are only sent when
 * WHATSAPP_USE_TEMPLATES is on; otherwise free text (Twilio sandbox / 24h window).
 */
@Injectable()
export class WhatsappTransport implements NotificationTransport {
  readonly channel = NotificationChannel.WHATSAPP;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly twilio: TwilioWhatsappProvider,
    private readonly meta: MetaCloudWhatsappProvider,
    private readonly log: LogWhatsappProvider,
  ) {}

  isEnabled(): boolean {
    return this.config.get('WHATSAPP_ENABLED', { infer: true });
  }

  private provider(): WhatsappProvider {
    const chosen = this.config.get('WHATSAPP_PROVIDER', { infer: true });
    if (chosen === 'meta') {
      return this.meta.isConfigured ? this.meta : this.log;
    }
    return this.twilio.isConfigured ? this.twilio : this.log;
  }

  async send(message: RenderedMessage): Promise<void> {
    // Templates are opt-in: strip the payload so providers send free text until
    // approved templates exist (keeps the Twilio sandbox path working).
    const useTemplates = this.config.get('WHATSAPP_USE_TEMPLATES', {
      infer: true,
    });
    const outbound = useTemplates
      ? message
      : { ...message, template: undefined };
    await this.provider().send(outbound);
  }
}
