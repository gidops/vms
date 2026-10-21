import { z } from "zod";

/**
 * One row of the live Evacuation Roll: a CHECKED_IN visitor who answered "Yes"
 * to needing evacuation assistance at intake.
 */
export const EvacuationRollRow = z.object({
  visitId: z.string().uuid(),
  fullName: z.string(),
  organization: z.string().nullable(),
  phone: z.string().nullable(),
  floor: z.string().nullable(),
  hostName: z.string().nullable(),
  checkInAt: z.coerce.date().nullable(),
  badge: z
    .object({ cardNumber: z.string(), zone: z.string().nullable() })
    .nullable(),
});
export type EvacuationRollRow = z.infer<typeof EvacuationRollRow>;

/** Rows are ordered by floor, top floor first (unknown floors last). */
export const EvacuationRoll = z.object({
  generatedAt: z.coerce.date(),
  /** Visitors on the roll (CHECKED_IN and needing assistance). */
  count: z.number().int().min(0),
  /** All visitors currently checked in (for the empty-state line). */
  checkedInTotal: z.number().int().min(0),
  rows: z.array(EvacuationRollRow),
});
export type EvacuationRoll = z.infer<typeof EvacuationRoll>;
