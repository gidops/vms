import { z } from "zod";
import { RiskLevel, VisitStatus, VisitType } from "../common/enums.js";
import { PaginationQuery } from "../common/pagination.js";
import { Visitor, RegisterVisitorInput } from "../visitor/visitor.schema.js";
import { HostWithUser } from "../host/host.schema.js";
import { Note } from "../note/note.schema.js";

/**
 * Selectable visit-purpose categories and building floors/departments. Kept as
 * shared constants so the form dropdowns (frontend) and any validation stay in
 * sync; the chosen value is stored as a plain string on the visit.
 */
export const VISIT_PURPOSES = [
  "Official",
  "Personal",
  "Client Meeting",
  "Private Meeting",
  "General Enquiry",
  "Interview",
  "Delivery",
  "Maintenance",
] as const;

export const FLOORS = [
  "Ground Floor",
  "Floor Mezzanine",
  "1st Floor",
  "2nd Floor",
  "3rd Floor - LW",
  "4th Floor",
  "5th Floor",
  "Rooftop",
] as const;

/**
 * The ordered lifecycle a visit moves through. The UI Timeline/stepper and the
 * backend state machine both derive their steps from this single list.
 */
export const VISIT_LIFECYCLE = [
  "INVITE_CREATED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "CHECKED_IN",
  "PASS_ISSUED",
  "CHECKED_OUT",
] as const;
export const VisitLifecycleStep = z.enum(VISIT_LIFECYCLE);
export type VisitLifecycleStep = z.infer<typeof VisitLifecycleStep>;

export const Visit = z.object({
  id: z.string().uuid(),
  visitorId: z.string().uuid(),
  hostId: z.string().uuid(),
  invitationId: z.string().uuid().nullable().optional(),
  type: VisitType,
  status: VisitStatus,
  purpose: z.string().min(1),
  /** Per-visit floor/department (distinct from the host's home office). */
  floor: z.string().nullable().optional(),
  riskLevel: RiskLevel.nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  checkInAt: z.coerce.date().nullable().optional(),
  checkOutAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Visit = z.infer<typeof Visit>;

/** A visit joined with its visitor — the common read model for list/detail views. */
export const VisitWithVisitor = Visit.extend({ visitor: Visitor });
export type VisitWithVisitor = z.infer<typeof VisitWithVisitor>;

/** A row in the admin approval queue — visit + visitor + host + origin. */
export const VisitListItem = Visit.extend({
  visitor: Visitor,
  host: HostWithUser,
  createdByName: z.string().nullable().optional(),
});
export type VisitListItem = z.infer<typeof VisitListItem>;

export const CreateVisitRequestInput = z.object({
  visitorId: z.string().uuid(),
  hostId: z.string().uuid(),
  type: VisitType,
  purpose: z.string().min(1),
  scheduledAt: z.coerce.date().optional(),
});
export type CreateVisitRequestInput = z.infer<typeof CreateVisitRequestInput>;

/**
 * VMC creates one or more visits for a chosen host — the "New Invite Request" and
 * "Register Walk-In" forms. One visit is created per visitor (each independently
 * approvable), all sharing the host, floor, purpose, schedule and notes. Walk-ins
 * (type WALK_IN) are auto-approved server-side; invites start PENDING.
 */
export const CreateVisitsInput = z.object({
  type: VisitType,
  hostUserId: z.string().uuid(),
  floor: z.string().min(1).optional(),
  purpose: z.string().min(1),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
  visitors: z.array(RegisterVisitorInput).min(1).max(50),
});
export type CreateVisitsInput = z.infer<typeof CreateVisitsInput>;

/**
 * List visits for the admin approval queue (paginated). With `scope: "mine"` the
 * result is restricted server-side to visits the requesting user hosts — this
 * powers the staff "My Visits" / "Recent Visitors" screens. `type`, `purpose`
 * and the `dateFrom`/`dateTo` window are the staff filter-bar facets.
 */
export const VisitListQuery = PaginationQuery.extend({
  status: VisitStatus.optional(),
  scope: z.enum(["all", "mine"]).default("all"),
  type: VisitType.optional(),
  purpose: z.string().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type VisitListQuery = z.infer<typeof VisitListQuery>;

/** Host resubmits a NEEDS_MORE_INFO visit after editing — transitions back to PENDING. */
export const ResubmitVisitInput = z
  .object({
    purpose: z.string().min(1).optional(),
    scheduledAt: z.coerce.date().optional(),
  })
  .default({});
export type ResubmitVisitInput = z.infer<typeof ResubmitVisitInput>;

export const DenyVisitInput = z.object({
  reason: z.string().min(1),
});
export type DenyVisitInput = z.infer<typeof DenyVisitInput>;

/**
 * Full visit-request detail powering the "Visit Request Details" drawer —
 * visit + visitor + host(+user) + notes, plus origin (who created it, source).
 */
export const VisitRequestDetail = Visit.extend({
  visitor: Visitor,
  host: HostWithUser,
  notes: z.array(Note).default([]),
  source: z.string().nullable().optional(),
  createdById: z.string().uuid().nullable().optional(),
  createdByName: z.string().nullable().optional(),
});
export type VisitRequestDetail = z.infer<typeof VisitRequestDetail>;

/** Reception edit of a pending request (purpose / schedule). */
export const UpdateVisitRequestInput = z
  .object({
    purpose: z.string().min(1).optional(),
    scheduledAt: z.coerce.date().optional(),
  })
  .refine((v) => v.purpose !== undefined || v.scheduledAt !== undefined, {
    message: "Provide at least one field to update",
  });
export type UpdateVisitRequestInput = z.infer<typeof UpdateVisitRequestInput>;
