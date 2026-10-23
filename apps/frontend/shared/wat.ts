/**
 * Africa/Lagos (WAT) display helpers. The operator's browser may not be on WAT,
 * so every time shown for the building (check-in, generated-at, consent dates)
 * is formatted explicitly in Africa/Lagos.
 */
export const WAT_TIME_ZONE = "Africa/Lagos";

/**
 * Intl locale for dates. Plain "en" formats US-style ("Oct 18, 2026"); the
 * building reads dates day-first ("18 Oct 2026"), so English maps to en-GB.
 */
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

/** Add whole days to a YYYY-MM-DD string. */
export function addDaysIso(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
