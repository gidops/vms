import { z } from "zod";

const dayBounds = {
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
};
const isDayWindow = (from: Date, to: Date) =>
  to >= from && to.getTime() - from.getTime() <= 26 * 60 * 60 * 1000;

export const AdminStatsQuery = z
  .object({
    ...dayBounds,
    yesterdayFrom: z.coerce.date(),
    yesterdayTo: z.coerce.date(),
  })
  .refine(
    (q) =>
      isDayWindow(q.dateFrom, q.dateTo) &&
      isDayWindow(q.yesterdayFrom, q.yesterdayTo),
    "Invalid day window",
  );
export type AdminStatsQuery = z.infer<typeof AdminStatsQuery>;

export const AdminTrafficQuery = z
  .object({
    ...dayBounds,
    timeZone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value }).format();
          return true;
        } catch {
          return false;
        }
      }, "Invalid time zone"),
  })
  .refine((q) => isDayWindow(q.dateFrom, q.dateTo), "Invalid day window");
export type AdminTrafficQuery = z.infer<typeof AdminTrafficQuery>;

/** Person counts, except pending/reviewRequested which count logical requests. */
export interface AdminOverviewStats {
  visitorsToday: number;
  visitorsYesterday: number;
  expected: number;
  pending: number;
  reviewRequested: number;
  onsite: number;
  checkedOutToday: number;
  checkedInToday: number;
  deniedToday: number;
}

export interface AdminTrafficPoint {
  hour: number;
  value: number;
}
