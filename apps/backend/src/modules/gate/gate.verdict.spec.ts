import { gateVerdict, type GateVisitFacts } from './gate.verdict';

// 10:00 WAT on 2026-10-28.
const NOW = new Date('2026-10-28T09:00:00Z');

const visit = (over: Partial<GateVisitFacts> = {}): GateVisitFacts => ({
  type: 'PRE_INVITED',
  status: 'APPROVED',
  scheduledAt: new Date('2026-10-28T13:00:00Z'),
  ...over,
});

describe('gateVerdict', () => {
  it('is VALID_TODAY for an approved visit scheduled today (WAT)', () => {
    expect(gateVerdict(visit(), NOW)).toBe('VALID_TODAY');
    // 00:30 and 23:30 WAT are still the same WAT day.
    expect(
      gateVerdict(
        visit({ scheduledAt: new Date('2026-10-27T23:30:00Z') }),
        NOW,
      ),
    ).toBe('VALID_TODAY');
    expect(
      gateVerdict(
        visit({ scheduledAt: new Date('2026-10-28T22:30:00Z') }),
        NOW,
      ),
    ).toBe('VALID_TODAY');
  });

  it('is WRONG_DAY for an approved visit on another day', () => {
    for (const at of [
      '2026-10-27T22:59:00Z', // 23:59 WAT yesterday
      '2026-10-28T23:00:00Z', // 00:00 WAT tomorrow
      '2026-11-05T09:00:00Z',
    ]) {
      expect(gateVerdict(visit({ scheduledAt: new Date(at) }), NOW)).toBe(
        'WRONG_DAY',
      );
    }
    expect(gateVerdict(visit({ scheduledAt: null }), NOW)).toBe('WRONG_DAY');
  });

  it('reads awaiting-approval statuses as NOT_CONFIRMED', () => {
    for (const status of ['PENDING', 'REVIEW_REQUESTED', 'FLAGGED'] as const) {
      expect(gateVerdict(visit({ status }), NOW)).toBe('NOT_CONFIRMED');
    }
  });

  it('reads finished or refused visits as CLOSED', () => {
    for (const status of [
      'CANCELLED',
      'DENIED',
      'EXPIRED',
      'CHECKED_OUT',
    ] as const) {
      expect(gateVerdict(visit({ status }), NOW)).toBe('CLOSED');
    }
  });

  it('reports a checked-in visitor as ALREADY_CHECKED_IN', () => {
    expect(gateVerdict(visit({ status: 'CHECKED_IN' }), NOW)).toBe(
      'ALREADY_CHECKED_IN',
    );
  });

  it('treats unknown and walk-in codes as NOT_FOUND', () => {
    expect(gateVerdict(null, NOW)).toBe('NOT_FOUND');
    expect(gateVerdict(visit({ type: 'WALK_IN' }), NOW)).toBe('NOT_FOUND');
  });

  it('accepts appointments as well as pre-invites', () => {
    expect(gateVerdict(visit({ type: 'APPOINTMENT' }), NOW)).toBe(
      'VALID_TODAY',
    );
  });
});
