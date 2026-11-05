import { z } from "zod";
import { EvacuationAssistType } from "../visit/visit.schema.js";

export const EvacuationRollRow = z.object({
  visitId: z.string().uuid(),
  fullName: z.string(),
  organization: z.string().nullable(),
  phone: z.string().nullable(),
  floor: z.string().nullable(),
  hostName: z.string().nullable(),
  /** Empty on legacy visits. */
  assistTypes: z.array(EvacuationAssistType),
  assistOther: z.string().nullable(),
  checkInAt: z.coerce.date().nullable(),
  badge: z
    .object({ cardNumber: z.string(), zone: z.string().nullable() })
    .nullable(),
  /** Personalised RFID card number, if the visitor holds one. */
  rfidCardNumber: z.string().nullable().optional(),
});
export type EvacuationRollRow = z.infer<typeof EvacuationRollRow>;

/** Rows are ordered by floor, top floor first (unknown floors last). */
export const EvacuationRoll = z.object({
  generatedAt: z.coerce.date(),
  count: z.number().int().min(0),
  checkedInTotal: z.number().int().min(0),
  rows: z.array(EvacuationRollRow),
});
export type EvacuationRoll = z.infer<typeof EvacuationRoll>;
