import type { RenderedMessage } from '../../notification.types';

/**
 * A concrete WhatsApp-sending backend (Twilio, Meta Cloud API, …) behind
 * WhatsappTransport. Mirrors EmailProvider so the channel is provider-swappable
 * via WHATSAPP_PROVIDER without touching business code.
 */
export interface WhatsappProvider {
  /** Whether the provider has the config it needs to send. */
  readonly isConfigured: boolean;
  /** Human-readable provider name (for logs). */
  readonly name: string;
  /** Deliver a message. Throws on failure so the dispatcher can retry. */
  send(message: RenderedMessage): Promise<void>;
}
