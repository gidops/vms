import { z } from "zod";
import { PaginationQuery } from "../common/pagination.js";
import { VisitStatus, VisitType } from "../common/enums.js";

/** Chosen server-side from permissions; `self` = visits the caller created or hosts. */
export const InsightsScope = z.enum(["facility", "self"]);
export type InsightsScope = z.infer<typeof InsightsScope>;

/** WAT calendar days, ending today. */
export const InsightsRange = z.enum(["7d", "30d", "90d"]);
export type InsightsRange = z.infer<typeof InsightsRange>;

export const INSIGHTS_RANGE_DAYS: Record<InsightsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const InsightsVisitorsQuery = PaginationQuery.extend({
  search: z.string().trim().min(1).optional(),
});
export type InsightsVisitorsQuery = z.infer<typeof InsightsVisitorsQuery>;

export const InsightsVisitorItem = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  organization: z.string().nullable(),
  visitCount: z.number().int().min(0),
  firstVisitAt: z.coerce.date().nullable(),
  lastVisitAt: z.coerce.date().nullable(),
  /** null = never asked. */
  commsOptIn: z.boolean().nullable(),
});
export type InsightsVisitorItem = z.infer<typeof InsightsVisitorItem>;

export const InsightsVisitorVisit = z.object({
  id: z.string().uuid(),
  status: VisitStatus,
  type: VisitType,
  purpose: z.string(),
  floor: z.string().nullable(),
  hostName: z.string().nullable(),
  scheduledAt: z.coerce.date().nullable(),
  checkInAt: z.coerce.date().nullable(),
  checkOutAt: z.coerce.date().nullable(),
});
export type InsightsVisitorVisit = z.infer<typeof InsightsVisitorVisit>;

export const InsightsVisitorDetail = InsightsVisitorItem.extend({
  phone: z.string().nullable(),
  avgDurationMinutes: z.number().nullable(),
  visits: z.array(InsightsVisitorVisit),
});
export type InsightsVisitorDetail = z.infer<typeof InsightsVisitorDetail>;

export const InsightsAnalyticsQuery = z.object({
  range: InsightsRange.default("30d"),
});
export type InsightsAnalyticsQuery = z.infer<typeof InsightsAnalyticsQuery>;

const Count = z.object({ key: z.string(), count: z.number().int().min(0) });
export type InsightsCount = z.infer<typeof Count>;

export const InsightsAnalytics = z.object({
  scope: InsightsScope,
  range: InsightsRange,
  totals: z.object({
    /** Visits in the window, excluding denied / cancelled / expired. */
    visits: z.number().int(),
    uniqueVisitors: z.number().int(),
    arrived: z.number().int(),
    denied: z.number().int(),
    cancelled: z.number().int(),
    noShows: z.number().int(),
    upcoming: z.number().int(),
    avgDurationMinutes: z.number().nullable(),
    allTimeVisits: z.number().int(),
  }),
  daily: z.array(z.object({ date: z.string(), count: z.number().int() })),
  weekly: z.array(z.object({ weekStart: z.string(), count: z.number().int() })),
  hourly: z.array(
    z.object({ hour: z.number().int(), count: z.number().int() }),
  ),
  byStatus: z.array(Count),
  byType: z.array(Count),
  /** Empty in self scope. */
  topHosts: z.array(Count),
  topOrganizations: z.array(Count),
  topVisitors: z.array(Count),
  /** Empty in self scope. */
  onsiteByFloor: z.array(Count),
  security: z
    .object({
      flagged: z.number().int(),
      alertsRaised: z.number().int(),
      alertsOpen: z.number().int(),
      deniedDaily: z.array(
        z.object({ date: z.string(), count: z.number().int() }),
      ),
    })
    .nullable(),
});
export type InsightsAnalytics = z.infer<typeof InsightsAnalytics>;
