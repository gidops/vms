import { watTodayIso } from "@/shared/wat";

/** WAT wall-clock date + time as ISO, or "" while either input is incomplete. */
export function watIso(date: string, time: string): string {
  const d = new Date(`${date}T${time}:00+01:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function splitWat(iso: string): { date: string; time: string } {
  const wat = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  const s = wat.toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

/** Default validity: today, 08:00 → 18:00 WAT. */
export function defaultValidity(now: Date = new Date()) {
  const today = watTodayIso(now);
  return {
    fromDate: today,
    fromTime: "08:00",
    untilDate: today,
    untilTime: "18:00",
  };
}
