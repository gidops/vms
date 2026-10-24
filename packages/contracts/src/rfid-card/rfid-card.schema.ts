import { z } from "zod";
import { PaginationQuery } from "../common/pagination.js";
import { VisitStatus } from "../common/enums.js";

/**
 * Personalised RFID access cards (Operations → Access cards). Another
 * department configures the card's doors and floors; the System Admin team
 * logs it here, prints the visitor's photo and validity on it, and assigns it.
 * Not to be confused with the visitor-pass badge pool (`AccessCard`) that
 * reception assigns at check-in.
 */
export const RfidCardStatus = z.enum([
  "AVAILABLE",
  "ASSIGNED",
  "LOST",
  "RETIRED",
]);
export type RfidCardStatus = z.infer<typeof RfidCardStatus>;

export const RfidAssignmentStatus = z.enum(["ACTIVE", "RETURNED", "LOST"]);
export type RfidAssignmentStatus = z.infer<typeof RfidAssignmentStatus>;

/** The number printed on / encoded in the card (trimmed, upper-cased). */
export const RfidCardNumber = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((s) => s.toUpperCase());

export const AssignRfidCardInput = z
  .object({
    cardNumber: RfidCardNumber,
    visitorId: z.string().uuid(),
    visitId: z.string().uuid().optional(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
    photoKey: z.string().min(1).max(512).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.validUntil > v.validFrom, {
    path: ["validUntil"],
    message: "Valid until must be after valid from",
  });
export type AssignRfidCardInput = z.infer<typeof AssignRfidCardInput>;

export const UpdateRfidAssignmentInput = z.object({
  validUntil: z.coerce.date().optional(),
  photoKey: z.string().min(1).max(512).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type UpdateRfidAssignmentInput = z.infer<
  typeof UpdateRfidAssignmentInput
>;

/** Close an active assignment: the card came back, or it is lost. */
export const CloseRfidAssignmentInput = z.object({
  outcome: z.enum(["RETURNED", "LOST"]),
  note: z.string().trim().max(1000).optional(),
});
export type CloseRfidAssignmentInput = z.infer<typeof CloseRfidAssignmentInput>;

/** Mark a lost card found again (AVAILABLE) or take a card out of use. */
export const SetRfidCardStatusInput = z.object({
  status: z.enum(["AVAILABLE", "RETIRED"]),
  note: z.string().trim().max(1000).optional(),
});
export type SetRfidCardStatusInput = z.infer<typeof SetRfidCardStatusInput>;

export const RfidCardListQuery = PaginationQuery.extend({
  status: RfidCardStatus.optional(),
  search: z.string().trim().min(1).optional(),
});
export type RfidCardListQuery = z.infer<typeof RfidCardListQuery>;

export const RfidAssignmentListQuery = PaginationQuery.extend({
  /** `active` (default) = cards out now; `history` = returned / lost. */
  view: z.enum(["active", "history"]).default("active"),
  cardId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
});
export type RfidAssignmentListQuery = z.infer<typeof RfidAssignmentListQuery>;

const VisitorRef = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  organization: z.string().nullable(),
});

export const RfidAssignmentItem = z.object({
  id: z.string().uuid(),
  status: RfidAssignmentStatus,
  card: z.object({ id: z.string().uuid(), cardNumber: z.string() }),
  visitor: VisitorRef,
  visitId: z.string().uuid().nullable(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  /** Still out after `validUntil`: reception should retrieve it. */
  overdue: z.boolean(),
  hasPhoto: z.boolean(),
  issuedAt: z.coerce.date(),
  issuedByName: z.string().nullable(),
  printCount: z.number().int(),
  lastPrintedAt: z.coerce.date().nullable(),
  returnedAt: z.coerce.date().nullable(),
  returnedByName: z.string().nullable(),
  closeNote: z.string().nullable(),
  notes: z.string().nullable(),
});
export type RfidAssignmentItem = z.infer<typeof RfidAssignmentItem>;

export const RfidAssignmentDetail = RfidAssignmentItem.extend({
  /** Short-lived signed URL for the visitor photo (photos are personal data). */
  photoUrl: z.string().url().nullable(),
  photoKey: z.string().nullable(),
  visit: z
    .object({
      id: z.string().uuid(),
      status: VisitStatus,
      scheduledAt: z.coerce.date().nullable(),
      purpose: z.string(),
    })
    .nullable(),
});
export type RfidAssignmentDetail = z.infer<typeof RfidAssignmentDetail>;

export const RfidCardItem = z.object({
  id: z.string().uuid(),
  cardNumber: z.string(),
  status: RfidCardStatus,
  notes: z.string().nullable(),
  timesIssued: z.number().int(),
  /** The open assignment while the card is out. */
  current: z
    .object({
      assignmentId: z.string().uuid(),
      visitorName: z.string(),
      validUntil: z.coerce.date(),
    })
    .nullable(),
  createdAt: z.coerce.date(),
});
export type RfidCardItem = z.infer<typeof RfidCardItem>;
