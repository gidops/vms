import { Controller, Header, type MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, type Observable, takeUntil, timer } from 'rxjs';
import { LiveHub } from './live.hub';

/** Keeps idle proxies from closing the stream. */
export const HEARTBEAT_MS = 25_000;
/**
 * A stream outlives the access token that opened it, so it is capped and the
 * browser reconnects with a current token (a revoked session can't listen on).
 */
export const STREAM_LIFETIME_MS = 5 * 60_000;

@Controller('live')
export class LiveController {
  constructor(private readonly hub: LiveHub) {}

  /** Server-sent change hints for any signed-in user (global JwtAuthGuard). */
  @Sse('stream')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  stream(): Observable<MessageEvent> {
    const changes = this.hub.stream.pipe(
      map((type): MessageEvent => ({ type: 'change', data: { type } })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: '' })),
    );
    return merge(changes, heartbeat).pipe(takeUntil(timer(STREAM_LIFETIME_MS)));
  }
}
