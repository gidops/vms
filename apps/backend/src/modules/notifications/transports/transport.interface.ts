import type { NotificationChannel } from '@prisma/client';
import type { RenderedMessage } from '../notification.types';

/**
 * A delivery channel implementation (Email, SMS, WhatsApp, …). Business code
 * never talks to a provider SDK directly — it enqueues a Notification and the
 * dispatcher routes it to the registered transport. Swapping providers (e.g.
 * Twilio → Meta) is a transport-only change.
 */
export interface NotificationTransport {
  readonly channel: NotificationChannel;
  /** Whether this channel is turned on (feature toggle). */
  isEnabled(): boolean;
  /** Deliver a rendered message. Throws on failure so the dispatcher can retry. */
  send(message: RenderedMessage): Promise<void>;
}

/** DI token for the array of all registered transports. */
export const NOTIFICATION_TRANSPORTS = 'NOTIFICATION_TRANSPORTS';
