import { z } from "zod";
import { RiskLevel, VisitStatus, VisitType } from "../common/enums.js";
import { Visitor } from "../visitor/visitor.schema.js";

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

export const CreateVisitRequestInput = z.object({
  visitorId: z.string().uuid(),
  hostId: z.string().uuid(),
  type: VisitType,
  purpose: z.string().min(1),
  scheduledAt: z.coerce.date().optional(),
});
export type CreateVisitRequestInput = z.infer<typeof CreateVisitRequestInput>;

export const DenyVisitInput = z.object({
  reason: z.string().min(1),
});
export type DenyVisitInput = z.infer<typeof DenyVisitInput>;
