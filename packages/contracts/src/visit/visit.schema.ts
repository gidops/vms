import { z } from "zod";
import {
  PassStatus,
  RiskLevel,
  VisitStatus,
  VisitType,
} from "../common/enums.js";
import { PaginationQuery } from "../common/pagination.js";
import { normalizeE164 } from "../common/phone.js";
import { Visitor, RegisterVisitorInput } from "../visitor/visitor.schema.js";
import { HostWithUser } from "../host/host.schema.js";
import { Note } from "../note/note.schema.js";
import { Alert } from "../alert/alert.schema.js";

/** Stored on the visit as plain strings, not enums. */
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

export const EVACUATION_ASSIST_TYPES = [
  "MOBILITY",
  "VISUAL",
  "HEARING",
  "MEDICAL",
  "OTHER",
] as const;
export const EvacuationAssistType = z.enum(EVACUATION_ASSIST_TYPES);
export type EvacuationAssistType = z.infer<typeof EvacuationAssistType>;

export const EVACUATION_ASSIST_OTHER_MAX = 200;

/** Shared by every intake path; returns [path, message] pairs. */
export function evacuationAssistIssues(answer: {
  needsEvacuationAssist: boolean;
  evacuationAssistTypes?: readonly EvacuationAssistType[];
  evacuationAssistOther?: string | null;
}): [string, string][] {
  const types = answer.evacuationAssistTypes ?? [];
  const issues: [string, string][] = [];
  if (!answer.needsEvacuationAssist) {
    if (types.length > 0)
      issues.push([
        "evacuationAssistTypes",
        "Assistance types only apply when assistance is needed",
      ]);
    return issues;
  }
  if (types.length === 0)
    issues.push(["evacuationAssistTypes", "Choose the assistance needed"]);
  if (types.includes("OTHER") && !answer.evacuationAssistOther?.trim())
    issues.push(["evacuationAssistOther", "Describe the assistance needed"]);
  return issues;
}

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
  hostId: z.string().uuid().nullable().optional(),
  invitationId: z.string().uuid().nullable().optional(),
  /** Set only for a true group visit; bulk submissions are independent visits. */
  groupId: z.string().uuid().nullable().optional(),
  isGroupVisit: z.boolean().default(false),
  groupName: z.string().nullable().optional(),
  /** Free-text email or phone number. */
  groupContact: z.string().nullable().optional(),
  /** Also the QR payload for invites; null only on legacy walk-ins. */
  referenceCode: z.string().nullable().optional(),
  type: VisitType,
  status: VisitStatus,
  purpose: z.string().min(1),
  floor: z.string().nullable().optional(),
  riskLevel: RiskLevel.nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  gateValidatedAt: z.coerce.date().nullable().optional(),
  checkInAt: z.coerce.date().nullable().optional(),
  checkOutAt: z.coerce.date().nullable().optional(),
  /** `null` = legacy visit, never asked. */
  needsEvacuationAssist: z.boolean().nullable().optional(),
  evacuationAssistTypes: z.array(EvacuationAssistType).default([]),
  evacuationAssistOther: z.string().nullable().optional(),
  /** Answer at this visit only; current opt-in status is the latest consent event. */
  commsConsent: z.boolean().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Visit = z.infer<typeof Visit>;

export const VisitPass = z.object({
  cardNumber: z.string(),
  zone: z.string().nullable().optional(),
  status: PassStatus,
  assignedAt: z.coerce.date().nullable().optional(),
});
export type VisitPass = z.infer<typeof VisitPass>;

/** The visitor's active personalised RFID card, shown wherever reception sees them. */
export const HeldRfidCard = z.object({
  assignmentId: z.string().uuid(),
  cardNumber: z.string(),
  validUntil: z.coerce.date(),
  overdue: z.boolean(),
});
export type HeldRfidCard = z.infer<typeof HeldRfidCard>;

export const VisitListItem = Visit.extend({
  visitor: Visitor,
  rfidCard: HeldRfidCard.nullable().optional(),
  host: HostWithUser.nullable(),
  createdByName: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  /** Use `isGroupVisit`, not `groupSize > 1`, to detect a group row. */
  groupSize: z.number().int().min(1).default(1),
});
export type VisitListItem = z.infer<typeof VisitListItem>;

/** `hostUserId`/`scheduledAt` are enforced per visit type by CreateVisitsInput. */
export const CreateVisitGuest = RegisterVisitorInput.extend({
  hostUserId: z.string().uuid().optional(),
  floor: z.string().min(1).optional(),
  purpose: z.string().min(1),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
  needsEvacuationAssist: z.boolean(),
  evacuationAssistTypes: z.array(EvacuationAssistType).max(5).optional(),
  evacuationAssistOther: z
    .string()
    .trim()
    .max(EVACUATION_ASSIST_OTHER_MAX)
    .optional(),
  commsConsent: z.boolean(),
});
export type CreateVisitGuest = z.infer<typeof CreateVisitGuest>;

/** One visit per guest; invites need a host and schedule per guest, walk-ins neither. */
export const CreateVisitsInput = z
  .object({
    type: VisitType,
    guests: z.array(CreateVisitGuest).min(1).max(50),
    isGroupVisit: z.boolean().optional().default(false),
    groupName: z.string().min(1).optional(),
    groupContact: z.string().min(1).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.isGroupVisit && !val.groupName?.trim())
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupName"],
        message: "Group name is required for a group visit",
      });
    val.guests.forEach((g, i) => {
      for (const [field, message] of evacuationAssistIssues(g))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guests", i, field],
          message,
        });
    });
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

export const BulkApproveVisitsInput = z.object({
  visitIds: z.array(z.string().uuid()).min(1),
});
export type BulkApproveVisitsInput = z.infer<typeof BulkApproveVisitsInput>;

export const BulkDenyVisitsInput = z.object({
  visitIds: z.array(z.string().uuid()).min(1),
  reason: z.string().min(1),
});
export type BulkDenyVisitsInput = z.infer<typeof BulkDenyVisitsInput>;

export const CheckInVisitInput = z.object({
  accessCardId: z.string().uuid(),
});
export type CheckInVisitInput = z.infer<typeof CheckInVisitInput>;

/** A visitor holding an RFID card can't be checked out without saying what happened to it. */
export const CheckOutRfidCard = z
  .object({
    outcome: z.enum(["RETURNED", "LOST"]),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.outcome === "RETURNED" || Boolean(v.note), {
    path: ["note"],
    message: "Say what happened to the card",
  });
export type CheckOutRfidCard = z.infer<typeof CheckOutRfidCard>;

/** `accessCardId` corrects the assigned badge; omitted releases the current one. */
export const CheckOutVisitInput = z
  .object({
    accessCardId: z.string().uuid().optional(),
    rfidCard: CheckOutRfidCard.optional(),
  })
  .default({});
export type CheckOutVisitInput = z.infer<typeof CheckOutVisitInput>;

/** `scope: "mine"` restricts server-side to visits the requester hosts. */
export const VisitListQuery = PaginationQuery.extend({
  status: VisitStatus.optional(),
  /** Comma-separated on the wire (`?statuses=APPROVED,CHECKED_IN`). */
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
  groupId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  /** Column the `dateFrom`/`dateTo` window applies to. */
  dateField: z.enum(["scheduledAt", "createdAt"]).default("scheduledAt"),
  /** Matches visitor name/email/organization, host name, floor and reference/pass code. */
  search: z.string().trim().min(1).optional(),
});
export type VisitListQuery = z.infer<typeof VisitListQuery>;

/** Moves a REVIEW_REQUESTED visit back to PENDING. */
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

/** Check-in stays blocked until the resulting SECURITY_REVIEW alert is resolved. */
export const FlagVisitInput = z.object({
  level: RiskLevel.default("HIGH"),
  reason: z.string().min(1),
  category: z.string().min(1).optional(),
});
export type FlagVisitInput = z.infer<typeof FlagVisitInput>;

export const RequestInfoInput = z.object({
  reason: z.string().min(1),
});
export type RequestInfoInput = z.infer<typeof RequestInfoInput>;

export const VisitRequestDetail = Visit.extend({
  visitor: Visitor,
  host: HostWithUser.nullable(),
  notes: z.array(Note).default([]),
  /** An open security alert blocks check-in. */
  alerts: z.array(Alert).default([]),
  source: z.string().nullable().optional(),
  createdById: z.string().uuid().nullable().optional(),
  createdByName: z.string().nullable().optional(),
  rfidCard: HeldRfidCard.nullable().optional(),
  /** The stored visitor record, when it differs from the name or organisation given at this visit. */
  storedVisitor: z
    .object({ fullName: z.string(), organization: z.string().nullable() })
    .nullable()
    .optional(),
  /** Data-URL QR of the referenceCode; null for walk-ins. */
  qrCode: z.string().nullable().optional(),
  pass: VisitPass.nullable().optional(),
  checkedInByName: z.string().nullable().optional(),
  checkedOutByName: z.string().nullable().optional(),
});
export type VisitRequestDetail = z.infer<typeof VisitRequestDetail>;

export const RateVisitInput = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});
export type RateVisitInput = z.infer<typeof RateVisitInput>;

/** Authorization (creator-only, pre-approval) is enforced by the service. */
export const UpdateVisitRequestInput = z
  .object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(3).transform(normalizeE164).optional(),
    organization: z.string().optional(),
    hostUserId: z.string().uuid().optional(),
    floor: z.string().min(1).optional(),
    purpose: z.string().min(1).optional(),
    scheduledAt: z.coerce.date().optional(),
    needsEvacuationAssist: z.boolean().optional(),
    evacuationAssistTypes: z.array(EvacuationAssistType).max(5).optional(),
    evacuationAssistOther: z
      .string()
      .trim()
      .max(EVACUATION_ASSIST_OTHER_MAX)
      .optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  })
  .superRefine((v, ctx) => {
    if (v.needsEvacuationAssist === undefined) return;
    for (const [field, message] of evacuationAssistIssues({
      needsEvacuationAssist: v.needsEvacuationAssist,
      evacuationAssistTypes: v.evacuationAssistTypes,
      evacuationAssistOther: v.evacuationAssistOther,
    }))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
  });
export type UpdateVisitRequestInput = z.infer<typeof UpdateVisitRequestInput>;
