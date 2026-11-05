import { z } from "zod";
import { AlertStatus, AlertType, RiskLevel } from "../common/enums.js";
import { Visitor } from "../visitor/visitor.schema.js";
import { Note } from "../note/note.schema.js";

export const Alert = z.object({
  id: z.string().uuid(),
  visitId: z.string().uuid().nullable().optional(),
  visitorId: z.string().uuid().nullable().optional(),
  type: AlertType,
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

export const AlertVisitContext = z.object({
  hostName: z.string().nullable().optional(),
  hostUnit: z.string().nullable().optional(),
  floor: z.string().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
});
export type AlertVisitContext = z.infer<typeof AlertVisitContext>;

export const AlertWithVisitor = Alert.extend({
  visitor: Visitor.nullable().optional(),
  notes: z.array(Note).default([]),
  visit: AlertVisitContext.nullable().optional(),
});
export type AlertWithVisitor = z.infer<typeof AlertWithVisitor>;

export const UpdateAlertStatusInput = z.object({
  status: z.enum(["ACKNOWLEDGED", "RESOLVED", "DISMISSED"]),
});
export type UpdateAlertStatusInput = z.infer<typeof UpdateAlertStatusInput>;
