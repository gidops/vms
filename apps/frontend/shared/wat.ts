/** Building times are always shown in Africa/Lagos, whatever the browser's zone. */
export const WAT_TIME_ZONE = "Africa/Lagos";

/** The building reads dates day-first, so English maps to en-GB. */
export function watDateLocale(locale: string) {
  return locale === "en" ? "en-GB" : locale;
}

/** "23:52" */
export function formatWatTime(date: Date | string | null, locale = "en") {
  if (!date) return "";
  return new Intl.DateTimeFormat(watDateLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: WAT_TIME_ZONE,
  }).format(new Date(date));
}

/** "18 Oct 2026, 18:42" */
export function formatWatDateTime(date: Date | string | null, locale = "en") {
  if (!date) return "";
  return new Intl.DateTimeFormat(watDateLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: WAT_TIME_ZONE,
  }).format(new Date(date));
}

/** Today's YYYY-MM-DD on the WAT calendar. */
export function watTodayIso(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: WAT_TIME_ZONE,
  }).format(now);
}

export function addDaysIso(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
