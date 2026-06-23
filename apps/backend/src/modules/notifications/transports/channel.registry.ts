import { Inject, Injectable } from '@nestjs/common';
import type { NotificationChannel } from '@prisma/client';
import {
  NOTIFICATION_TRANSPORTS,
  type NotificationTransport,
} from './transport.interface';

/**
 * Routes a channel to its transport. IN_APP has no transport — those
 * notifications are delivered by persisting the row, handled in the dispatcher.
 */
@Injectable()
export class ChannelRegistry {
  private readonly byChannel = new Map<
    NotificationChannel,
    NotificationTransport
  >();

  constructor(
    @Inject(NOTIFICATION_TRANSPORTS) transports: NotificationTransport[],
  ) {
    for (const t of transports) this.byChannel.set(t.channel, t);
  }

  get(channel: NotificationChannel): NotificationTransport | undefined {
    return this.byChannel.get(channel);
  }
}
