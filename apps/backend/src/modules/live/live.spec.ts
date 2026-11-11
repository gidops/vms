import type { MessageEvent } from '@nestjs/common';
import type { DomainEvent } from '../../shared/events/domain-event';
import {
  HEARTBEAT_MS,
  LiveController,
  STREAM_LIFETIME_MS,
} from './live.controller';
import { isLiveEvent, LiveHub } from './live.hub';

const event = (type: string): DomainEvent => ({
  id: 'e1',
  type,
  aggregateType: 'Visit',
  aggregateId: 'v1',
  payload: { visitorName: 'Ada Obi', phone: '+234800000000' },
  metadata: { actorUserId: 'u1' },
  occurredAt: 'now',
});

describe('isLiveEvent', () => {
  it.each([
    'visitor.checked_in',
    'visit.approved',
    'alert.created',
    'rfid_card.assigned',
    'visitor_pass.printed',
    'user.status_changed',
  ])('forwards %s', (type) => {
    expect(isLiveEvent(type)).toBe(true);
  });

  it.each([
    'auth.user_logged_in',
    'auth.login_failed',
    'authz.permission_denied',
    'report.visits_exported',
    'audit.exported',
  ])('keeps %s on the server', (type) => {
    expect(isLiveEvent(type)).toBe(false);
  });
});

describe('LiveController stream', () => {
  let hub: LiveHub;
  let received: MessageEvent[];
  let done: boolean;

  beforeEach(() => {
    jest.useFakeTimers();
    hub = new LiveHub();
    received = [];
    done = false;
    new LiveController(hub).stream().subscribe({
      next: (m) => received.push(m),
      complete: () => (done = true),
    });
  });

  afterEach(() => jest.useRealTimers());

  it('sends only the event type, never the payload', () => {
    hub.handle(event('visitor.checked_in'));
    expect(received).toEqual([
      { type: 'change', data: { type: 'visitor.checked_in' } },
    ]);
    expect(JSON.stringify(received)).not.toContain('Ada');
  });

  it('drops events that change nothing on screen, and non-events', () => {
    hub.handle(event('auth.user_logged_in'));
    hub.handle({ not: 'an event' });
    hub.handle(null);
    expect(received).toEqual([]);
  });

  it('sends a heartbeat so idle connections stay open', () => {
    jest.advanceTimersByTime(HEARTBEAT_MS);
    expect(received).toEqual([{ type: 'ping', data: '' }]);
  });

  it('ends after its lifetime so the browser reconnects with a fresh token', () => {
    jest.advanceTimersByTime(STREAM_LIFETIME_MS);
    expect(done).toBe(true);
    hub.handle(event('visit.approved'));
    expect(received.some((m) => m.type === 'change')).toBe(false);
  });
});
