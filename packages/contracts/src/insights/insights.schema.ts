import { z } from "zod";
import { PaginationQuery } from "../common/pagination.js";
import { VisitStatus, VisitType } from "../common/enums.js";

/**
 * Insights page (History / Visitors / Analytics). Every endpoint answers in one
 * of two scopes, chosen server-side from the caller's permissions: `facility`
 * (everyone's visits) or `self` (only visits the caller created or hosts).
 */
export const InsightsScope = z.enum(["facility", "self"]);
export type InsightsScope = z.infer<typeof InsightsScope>;

/** Analytics window presets (WAT calendar days, ending today). */
export const InsightsRange = z.enum(["7d", "30d", "90d"]);
export type InsightsRange = z.infer<typeof InsightsRange>;

export const INSIGHTS_RANGE_DAYS: Record<InsightsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

// ---------------------------------------------------------------- Visitors

export const InsightsVisitorsQuery = PaginationQuery.extend({
  /** Name, email, organisation or phone. */
  search: z.string().trim().min(1).optional(),
});
export type InsightsVisitorsQuery = z.infer<typeof InsightsVisitorsQuery>;

/** One person in the visitor directory, with counts over the caller's scope. */
export const InsightsVisitorItem = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  organization: z.string().nullable(),
  visitCount: z.number().int().min(0),
  firstVisitAt: z.coerce.date().nullable(),
  lastVisitAt: z.coerce.date().nullable(),
  /** Latest comms-consent answer (null = never asked). */
  commsOptIn: z.boolean().nullable(),
});
export type InsightsVisitorItem = z.infer<typeof InsightsVisitorItem>;

/** A single visit in one visitor's history. */
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
  /** Average minutes between check-in and check-out (completed visits only). */
  avgDurationMinutes: z.number().nullable(),
  visits: z.array(InsightsVisitorVisit),
});
export type InsightsVisitorDetail = z.infer<typeof InsightsVisitorDetail>;

// ---------------------------------------------------------------- Analytics

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
    /** Visits that actually arrived (checked in at some point). */
    arrived: z.number().int(),
    denied: z.number().int(),
    cancelled: z.number().int(),
    /** Approved but never arrived, now past their visit day (or expired). */
    noShows: z.number().int(),
    /** Approved / scheduled from today onward. */
    upcoming: z.number().int(),
    avgDurationMinutes: z.number().nullable(),
    /** Self scope: everyone the caller has ever hosted. */
    allTimeVisits: z.number().int(),
  }),
  /** One point per WAT day in the window (YYYY-MM-DD). */
  daily: z.array(z.object({ date: z.string(), count: z.number().int() })),
  /** One point per ISO week (Monday, YYYY-MM-DD) over the last 12 weeks. */
  weekly: z.array(z.object({ weekStart: z.string(), count: z.number().int() })),
  /** Arrivals per WAT hour of day (0–23) across the window. */
  hourly: z.array(
    z.object({ hour: z.number().int(), count: z.number().int() }),
  ),
  byStatus: z.array(Count),
  byType: z.array(Count),
  /** Top 5 by visit count. Facility scope only (empty for self). */
  topHosts: z.array(Count),
  topOrganizations: z.array(Count),
  /** Top 5 repeat visitors (by name). */
  topVisitors: z.array(Count),
  /** Who is on site now, by floor. Facility scope only. */
  onsiteByFloor: z.array(Count),
  /** Security Manager / System Admin only (null otherwise). */
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
