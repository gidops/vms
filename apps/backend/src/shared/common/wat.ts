/**
 * Africa/Lagos (WAT) calendar helpers. WAT is a fixed UTC+01:00 with no DST, so
 * day boundaries are computed arithmetically and never depend on the server's
 * own clock/zone.
 */
export const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of 00:00 WAT on the given `YYYY-MM-DD` day. */
export function watDayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - WAT_OFFSET_MS);
}

/**
 * Half-open UTC range `[gte, lt)` covering the WAT days `from`..`to` inclusive.
 */
export function watDayRange(from: string, to: string): { gte: Date; lt: Date } {
  return {
    gte: watDayStart(from),
    lt: new Date(watDayStart(to).getTime() + DAY_MS),
  };
}

/** `YYYY-MM-DD HH:mm` on the WAT clock, or '' for null. */
export function formatWat(date: Date | null | undefined): string {
  if (!date) return '';
  const w = new Date(date.getTime() + WAT_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${w.getUTCFullYear()}-${p(w.getUTCMonth() + 1)}-${p(w.getUTCDate())} ` +
    `${p(w.getUTCHours())}:${p(w.getUTCMinutes())}`
  );
}

/** Today's `YYYY-MM-DD` on the WAT calendar. */
export function watToday(now: Date = new Date()): string {
  return formatWat(now).slice(0, 10);
}
