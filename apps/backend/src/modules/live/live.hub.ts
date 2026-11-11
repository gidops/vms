import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject, type Observable } from 'rxjs';
import type { DomainEvent } from '../../shared/events/domain-event';

/**
 * Domains whose changes show up on someone's screen. Auth, security and export
 * events change nothing another browser displays, so they never leave here.
 */
const LIVE_PREFIXES = [
  'visit.',
  'visitor.',
  'invitation.',
  'alert.',
  'note.',
  'rfid_card.',
  'visitor_pass.',
  'consent.',
  'user.',
  'desk_qr.',
  'gate.',
  'notification.',
];

export function isLiveEvent(type: string): boolean {
  return LIVE_PREFIXES.some((prefix) => type.startsWith(prefix));
}

/**
 * Fans relayed domain events out to open browser streams. It consumes the bus
 * like the audit listener does, so the outbox/relay transport seam is untouched.
 * Only the event type leaves the server: browsers refetch what they're allowed
 * to see through the normal, permission-checked endpoints.
 */
@Injectable()
export class LiveHub {
  private readonly changes = new Subject<string>();

  get stream(): Observable<string> {
    return this.changes.asObservable();
  }

  @OnEvent('**')
  handle(event: unknown): void {
    const type = (event as Partial<DomainEvent> | null)?.type;
    if (typeof type === 'string' && isLiveEvent(type)) this.changes.next(type);
  }
}
