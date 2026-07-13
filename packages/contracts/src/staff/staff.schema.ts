import { z } from "zod";
import { PaginationQuery } from "../common/pagination.js";

/**
 * Staff "Today's Schedule" headline counts, all scoped to the signed-in host.
 * - expectedToday: APPROVED visits scheduled for today (awaiting arrival)
 * - awaitingApproval: PENDING + REVIEW_REQUESTED (needs the CSO / the host)
 * - onsite: currently CHECKED_IN
 */
export const StaffDashboardStats = z.object({
  expectedToday: z.number().int().min(0),
  awaitingApproval: z.number().int().min(0),
  onsite: z.number().int().min(0),
});
export type StaffDashboardStats = z.infer<typeof StaffDashboardStats>;

/**
 * Categories for the "Recent Updates" feed — mirror the design's coloured tags.
 * Each maps an underlying domain event to a human-facing grouping.
 */
export const StaffActivityCategory = z.enum([
  "ARRIVAL_UPDATE",
  "CSO_FEEDBACK",
  "REQUEST_UPDATE",
  "VISIT_STATUS",
  "SECURITY_ALERT",
]);
export type StaffActivityCategory = z.infer<typeof StaffActivityCategory>;

/** A single row in the host's "Recent Updates" activity feed. */
export const StaffActivityItem = z.object({
  id: z.string(),
  category: StaffActivityCategory,
  title: z.string().min(1),
  body: z.string(),
  /** Visitor name surfaced for emphasis in the card, when known. */
  subjectName: z.string().nullable().optional(),
  /** Deep-link target: the related visit or alert id (drives "View Details"). */
  visitId: z.string().uuid().nullable().optional(),
  alertId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
});
export type StaffActivityItem = z.infer<typeof StaffActivityItem>;

/** Activity-feed query: paginated, optionally narrowed to a day and/or category. */
export const StaffActivityQuery = PaginationQuery.extend({
  /** ISO date (YYYY-MM-DD); when set, only that day's updates are returned. */
  date: z.coerce.date().optional(),
  /** When set, only updates in this category are returned. */
  category: StaffActivityCategory.optional(),
});
export type StaffActivityQuery = z.infer<typeof StaffActivityQuery>;
