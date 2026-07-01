import { z } from "zod";
import {
  PassStatus,
  RiskLevel,
  VisitStatus,
  VisitType,
} from "../common/enums.js";
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
  /** Host is optional for walk-ins (the guest may not be visiting a named staff). */
  hostId: z.string().uuid().nullable().optional(),
  invitationId: z.string().uuid().nullable().optional(),
  /** Visits created together in one invite/walk-in submission share a groupId. */
  groupId: z.string().uuid().nullable().optional(),
  /**
   * Human-friendly invite code (e.g. "5A19-795") generated for invites at
   * creation. Encoded in the QR the guest presents; null for walk-ins.
   */
  referenceCode: z.string().nullable().optional(),
  type: VisitType,
  status: VisitStatus,
  purpose: z.string().min(1),
  /** Per-visit floor/department (distinct from the host's home office). */
  floor: z.string().nullable().optional(),
  riskLevel: RiskLevel.nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  /** Set when the gate validates the QR (or auto-set at VMC check-in for now). */
  gateValidatedAt: z.coerce.date().nullable().optional(),
  checkInAt: z.coerce.date().nullable().optional(),
  checkOutAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Visit = z.infer<typeof Visit>;

/**
 * The physical access badge assigned to a visit at check-in and released at
 * check-out. `cardNumber` is the number shown on the pass (e.g. "0019").
 */
export const VisitPass = z.object({
  cardNumber: z.string(),
  zone: z.string().nullable().optional(),
  status: PassStatus,
  assignedAt: z.coerce.date().nullable().optional(),
});
export type VisitPass = z.infer<typeof VisitPass>;

/** A visit joined with its visitor — the common read model for list/detail views. */
export const VisitWithVisitor = Visit.extend({ visitor: Visitor });
export type VisitWithVisitor = z.infer<typeof VisitWithVisitor>;

/** A row in the admin approval queue — visit + visitor + host + origin. */
export const VisitListItem = Visit.extend({
  visitor: Visitor,
  host: HostWithUser.nullable(),
  createdByName: z.string().nullable().optional(),
  /**
   * Number of visits sharing this visit's `groupId`. Every visit always has a
   * groupId (even a lone guest), so `groupSize > 1` — not the presence of a
   * groupId — is what distinguishes a group visit from a single one.
   */
  groupSize: z.number().int().min(1).default(1),
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
 * One guest in a "New Invite Request" / "Register Walk-In" submission: the
 * visitor's details plus that guest's own visit details. The form's "Use same
 * visit details" toggle simply copies the first guest's visit details into the
 * others before submit — the wire format always carries details per guest so
 * guests can differ. `hostUserId` and `scheduledAt` are optional here and
 * enforced per visit type by CreateVisitsInput's refinement below.
 */
export const CreateVisitGuest = RegisterVisitorInput.extend({
  hostUserId: z.string().uuid().optional(),
  floor: z.string().min(1).optional(),
  purpose: z.string().min(1),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateVisitGuest = z.infer<typeof CreateVisitGuest>;

/**
 * VMC creates one or more visits — the "New Invite Request" and "Register Walk-In"
 * forms. One visit is created per guest (each independently approvable), sharing a
 * generated groupId so they can be checked in together. Walk-ins (type WALK_IN)
 * are auto-approved server-side; invites start PENDING and get a referenceCode/QR.
 * Invites require a host and a schedule on every guest; walk-ins need neither.
 */
export const CreateVisitsInput = z
  .object({
    type: VisitType,
    guests: z.array(CreateVisitGuest).min(1).max(50),
  })
  .superRefine((val, ctx) => {
    if (val.type === "WALK_IN") return;
    val.guests.forEach((g, i) => {
      if (!g.hostUserId)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guests", i, "hostUserId"],
          message: "Host is required for invites",
        });
      if (!g.scheduledAt)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guests", i, "scheduledAt"],
          message: "Visit date/time is required for invites",
        });
    });
  });
export type CreateVisitsInput = z.infer<typeof CreateVisitsInput>;

/** Assign a physical access badge to a visit at check-in (VMC). */
export const CheckInVisitInput = z.object({
  accessCardId: z.string().uuid(),
});
export type CheckInVisitInput = z.infer<typeof CheckInVisitInput>;

/**
 * Check a visit out. `accessCardId` lets the operator correct ("Change Pass ID")
 * the assigned badge before completing; omitted = release the current badge.
 */
export const CheckOutVisitInput = z
  .object({
    accessCardId: z.string().uuid().optional(),
  })
  .default({});
export type CheckOutVisitInput = z.infer<typeof CheckOutVisitInput>;

/**
 * List visits for the admin approval queue (paginated). With `scope: "mine"` the
 * result is restricted server-side to visits the requesting user hosts — this
 * powers the staff "My Visits" / "Recent Visitors" screens. `type`, `purpose`
 * and the `dateFrom`/`dateTo` window are the staff filter-bar facets.
 */
export const VisitListQuery = PaginationQuery.extend({
  status: VisitStatus.optional(),
  /**
   * Restrict to several statuses at once (the VMC "Today's Schedule" board shows
   * only APPROVED/CHECKED_IN/CHECKED_OUT). Accepts a comma-separated string on the
   * wire (`?statuses=APPROVED,CHECKED_IN`) and parses to a VisitStatus[].
   */
  statuses: z
    .preprocess(
      (v) =>
        typeof v === "string"
          ? v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : v,
      z.array(VisitStatus).min(1),
    )
    .optional(),
  scope: z.enum(["all", "mine"]).default("all"),
  type: VisitType.optional(),
  purpose: z.string().min(1).optional(),
  /** Restrict to the guests of one invite/walk-in submission (group check-in). */
  groupId: z.string().uuid().optional(),
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
  host: HostWithUser.nullable(),
  notes: z.array(Note).default([]),
  source: z.string().nullable().optional(),
  createdById: z.string().uuid().nullable().optional(),
  createdByName: z.string().nullable().optional(),
  /** Data-URL QR encoding the referenceCode (invites only); null for walk-ins. */
  qrCode: z.string().nullable().optional(),
  /** The access badge currently assigned (set at check-in, released at check-out). */
  pass: VisitPass.nullable().optional(),
});
export type VisitRequestDetail = z.infer<typeof VisitRequestDetail>;

/**
 * Reception edit of a not-yet-approved request via the pre-filled invite form.
 * Covers both the visitor's details and that visit's details; every field is
 * optional but at least one must be present. The service authorizes the edit
 * (creator-only, pre-approval) and applies the visitor vs visit changes.
 */
export const UpdateVisitRequestInput = z
  .object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(3).optional(),
    organization: z.string().optional(),
    hostUserId: z.string().uuid().optional(),
    floor: z.string().min(1).optional(),
    purpose: z.string().min(1).optional(),
    scheduledAt: z.coerce.date().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  });
export type UpdateVisitRequestInput = z.infer<typeof UpdateVisitRequestInput>;
