import { z } from "zod";
import { AlertStatus, RiskLevel } from "../common/enums.js";
import { Visitor } from "../visitor/visitor.schema.js";
import { Note } from "../note/note.schema.js";

/** A flagged-visitor / risk alert raised for CSO review. */
export const Alert = z.object({
  id: z.string().uuid(),
  visitId: z.string().uuid().nullable().optional(),
  visitorId: z.string().uuid().nullable().optional(),
  level: RiskLevel,
  status: AlertStatus,
  reason: z.string().min(1),
  category: z.string().nullable().optional(),
  raisedById: z.string().uuid().nullable().optional(),
  resolvedById: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Alert = z.infer<typeof Alert>;

/** The requesting-visit context shown on the alert detail (host/unit/floor/schedule). */
export const AlertVisitContext = z.object({
  hostName: z.string().nullable().optional(),
  hostUnit: z.string().nullable().optional(),
  floor: z.string().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
});
export type AlertVisitContext = z.infer<typeof AlertVisitContext>;

/** An alert joined with its visitor + notes — the detail read model. */
export const AlertWithVisitor = Alert.extend({
  visitor: Visitor.nullable().optional(),
  notes: z.array(Note).default([]),
  /** The visit that triggered the flag, when the alert is tied to one. */
  visit: AlertVisitContext.nullable().optional(),
});
export type AlertWithVisitor = z.infer<typeof AlertWithVisitor>;

/** CSO action: move an alert to a new lifecycle status. */
export const UpdateAlertStatusInput = z.object({
  status: z.enum(["ACKNOWLEDGED", "RESOLVED", "DISMISSED"]),
});
export type UpdateAlertStatusInput = z.infer<typeof UpdateAlertStatusInput>;
