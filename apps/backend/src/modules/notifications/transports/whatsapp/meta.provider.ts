import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import type { WhatsappProvider } from './whatsapp-provider.interface';

/** Strip any `whatsapp:` prefix — Meta wants a bare E.164 number. */
function toE164(value: string): string {
  return value.startsWith('whatsapp:')
    ? value.slice('whatsapp:'.length)
    : value;
}

/**
 * WhatsApp via the Meta WhatsApp Cloud API (direct Graph API, no BSP). Posts to
 * `/{phone-number-id}/messages` with a permanent system-user token. Sends an
 * approved template when the message carries one, otherwise free-form text.
 * Throws on a non-2xx response so the dispatcher retries.
 */
@Injectable()
export class MetaCloudWhatsappProvider implements WhatsappProvider {
  readonly name = 'meta';
  private readonly logger = new Logger(MetaCloudWhatsappProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get token(): string | undefined {
    return this.config.get('META_WHATSAPP_ACCESS_TOKEN', { infer: true });
  }

  private get phoneNumberId(): string | undefined {
    return this.config.get('META_WABA_PHONE_NUMBER_ID', { infer: true });
  }

  get isConfigured(): boolean {
    return Boolean(this.token && this.phoneNumberId);
  }

  async send(message: RenderedMessage): Promise<void> {
    const version = this.config.get('META_GRAPH_API_VERSION', { infer: true });
    const url = `https://graph.facebook.com/${version}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.payload(message)),
    });
    if (!res.ok) {
      // Body may contain the Meta error detail; it does not include our token.
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Meta WhatsApp send failed (${res.status} ${res.statusText}): ${detail}`,
      );
    }
    this.logger.debug(`Sent WhatsApp to ${message.to} via Meta Cloud API`);
  }

  /** Build the Graph API message body (template or free text). */
  private payload(message: RenderedMessage): Record<string, unknown> {
    const to = toE164(message.to ?? '');
    if (message.template) {
      return {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: message.template.name,
          language: { code: message.template.languageCode },
          components: [
            {
              type: 'body',
              parameters: message.template.variables.map((text) => ({
                type: 'text',
                text,
              })),
            },
          ],
        },
      };
    }
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message.text ?? '' },
    };
  }
}
