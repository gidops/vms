import { z } from "zod";
import { PaginationQuery } from "../common/pagination.js";

/** Scoped to visits the caller created or hosts; awaitingApproval = PENDING + REVIEW_REQUESTED. */
export const StaffDashboardStats = z.object({
  expectedToday: z.number().int().min(0),
  awaitingApproval: z.number().int().min(0),
  onsite: z.number().int().min(0),
});
export type StaffDashboardStats = z.infer<typeof StaffDashboardStats>;

export const StaffActivityCategory = z.enum([
  "ARRIVAL_UPDATE",
  "SM_FEEDBACK",
  "REQUEST_UPDATE",
  "VISIT_STATUS",
  "SECURITY_ALERT",
]);
export type StaffActivityCategory = z.infer<typeof StaffActivityCategory>;

export const StaffActivityItem = z.object({
  id: z.string(),
  category: StaffActivityCategory,
  title: z.string().min(1),
  body: z.string(),
  subjectName: z.string().nullable().optional(),
  /** The related visit or alert id. */
  visitId: z.string().uuid().nullable().optional(),
  alertId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
});
export type StaffActivityItem = z.infer<typeof StaffActivityItem>;

export const StaffActivityQuery = PaginationQuery.extend({
  search: z.string().trim().min(1).max(200).optional(),
  date: z.coerce.date().optional(),
  category: StaffActivityCategory.optional(),
});
export type StaffActivityQuery = z.infer<typeof StaffActivityQuery>;
