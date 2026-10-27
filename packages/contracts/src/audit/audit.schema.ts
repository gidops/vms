import { z } from "zod";
import { PaginationQuery } from "../common/pagination.js";
import { inclusiveDaySpan } from "../report/report.schema.js";

export const AUDIT_MAX_RANGE_DAYS = 366;

/** The action's leading segment; `auth` also covers `authz.*`. */
export const AUDIT_CATEGORIES = [
  "visit",
  "visitor",
  "invitation",
  "alert",
  "note",
  "user",
  "auth",
  "report",
  "consent",
  "desk_qr",
  "notification",
  "rfid_card",
  "audit",
] as const;
export const AuditCategory = z.enum(AUDIT_CATEGORIES);
export type AuditCategory = z.infer<typeof AuditCategory>;

const IsoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Audit filters. `from`/`to` are WAT calendar days, inclusive. */
export const AuditQuery = PaginationQuery.extend({
  from: IsoDay,
  to: IsoDay,
  category: AuditCategory.optional(),
  actorUserId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
}).superRefine((v, ctx) => {
  const span = inclusiveDaySpan(v.from, v.to);
  if (span < 1)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["to"],
      message: "End date must be on or after the start date",
    });
  else if (span > AUDIT_MAX_RANGE_DAYS)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["to"],
      message: `Range can be at most ${AUDIT_MAX_RANGE_DAYS} days`,
    });
});
export type AuditQuery = z.infer<typeof AuditQuery>;

export const AuditItem = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  action: z.string(),
  category: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  actor: z
    .object({ id: z.string().uuid(), fullName: z.string(), email: z.string() })
    .nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  correlationId: z.string().nullable(),
  metadata: z.unknown().nullable(),
});
export type AuditItem = z.infer<typeof AuditItem>;

/** `visit.approved` → `visit`; `authz.permission_denied` → `auth`. */
export function auditCategoryOf(action: string): string {
  const head = action.split(".")[0] ?? action;
  return head === "authz" ? "auth" : head;
}
