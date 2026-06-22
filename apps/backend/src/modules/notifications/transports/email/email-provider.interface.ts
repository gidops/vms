import type { RenderedMessage } from '../../notification.types';

/** A concrete email-sending backend (SMTP, SendGrid, …) behind EmailTransport. */
export interface EmailProvider {
  /** Whether the provider has the config it needs to send. */
  readonly isConfigured: boolean;
  /** Human-readable provider name (for logs). */
  readonly name: string;
  send(message: RenderedMessage, from: string): Promise<void>;
}
