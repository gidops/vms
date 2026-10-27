import type { NotificationChannel } from '@prisma/client';
import type { RenderedMessage } from '../notification.types';

/** Business code never calls a provider SDK directly; swapping providers is transport-only. */
export interface NotificationTransport {
  readonly channel: NotificationChannel;
  isEnabled(): boolean;
  send(message: RenderedMessage): Promise<void>;
}

export const NOTIFICATION_TRANSPORTS = 'NOTIFICATION_TRANSPORTS';
