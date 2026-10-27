import type { RenderedMessage } from '../../notification.types';

export interface WhatsappProvider {
  readonly isConfigured: boolean;
  readonly name: string;
  send(message: RenderedMessage): Promise<void>;
}
