import { formatWat, watDayRange, watDayStart, watToday } from './wat';

describe('WAT helpers', () => {
  it('starts a WAT day at 23:00 UTC the previous day', () => {
    expect(watDayStart('2026-10-17').toISOString()).toBe(
      '2026-10-16T23:00:00.000Z',
    );
  });

  it('covers from..to inclusive as a half-open UTC range', () => {
    const r = watDayRange('2026-10-17', '2026-10-17');
    expect(r.gte.toISOString()).toBe('2026-10-16T23:00:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-10-17T23:00:00.000Z');
    // 23:30 UTC on the 17th is already the 18th in Lagos.
    const lateUtc = new Date('2026-10-17T23:30:00Z');
    expect(lateUtc >= r.gte && lateUtc < r.lt).toBe(false);
    const earlyWat = new Date('2026-10-16T23:30:00Z');
    expect(earlyWat >= r.gte && earlyWat < r.lt).toBe(true);
  });

  it('formats on the WAT clock regardless of the server zone', () => {
    expect(formatWat(new Date('2026-10-17T23:30:00Z'))).toBe(
      '2026-10-18 00:30',
    );
    expect(formatWat(null)).toBe('');
    expect(watToday(new Date('2026-10-18T23:10:00Z'))).toBe('2026-10-19');
  });
});
