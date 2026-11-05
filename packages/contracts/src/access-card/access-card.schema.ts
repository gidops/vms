import { z } from "zod";
import { PaginationQuery } from "../common/pagination.js";

/**
 * The visitor-pass pool: physical badges reception hands out at check-in.
 * Each pass belongs to a floor-wing (a `FLOORS` name, the "Venue" printed on
 * it) and is numbered per floor-wing: "3rd Floor - Left Wing" 001 and
 * "3rd Floor - Right Wing" 001 are different passes.
 */

/** Pass IDs are printed as 3 digits ("007"); numbers past 999 just grow. */
export function formatPassNumber(n: number): string {
  return String(n).padStart(3, "0");
}

export const AccessCardQuery = z.object({
  zone: z.string().min(1).optional(),
  available: z.coerce.boolean().optional(),
});
export type AccessCardQuery = z.infer<typeof AccessCardQuery>;

export const AccessCardOption = z.object({
  id: z.string().uuid(),
  cardNumber: z.string().min(1),
  zone: z.string().min(1),
  available: z.boolean(),
});
export type AccessCardOption = z.infer<typeof AccessCardOption>;

// ── Visitor pass production (System Admin, Operations) ──────────────────────

export const VisitorPassStatus = z.enum(["AVAILABLE", "IN_USE", "RETIRED"]);
export type VisitorPassStatus = z.infer<typeof VisitorPassStatus>;

/** How a pass entered the record: printed by this system, or recorded as already existing. */
export const VisitorPassOrigin = z.enum(["PRINTED", "RECORDED", "NOT_PRINTED"]);
export type VisitorPassOrigin = z.infer<typeof VisitorPassOrigin>;

export const PassPrintKind = z.enum(["PRINTED", "REPRINTED", "RECORDED"]);
export type PassPrintKind = z.infer<typeof PassPrintKind>;

const Zone = z.string().trim().min(1).max(60);

export const VisitorPassQuery = PaginationQuery.extend({
  zone: Zone.optional(),
  status: VisitorPassStatus.optional(),
  search: z.string().trim().min(1).max(20).optional(),
});
export type VisitorPassQuery = z.infer<typeof VisitorPassQuery>;

export const VisitorPassItem = z.object({
  id: z.string().uuid(),
  zone: z.string(),
  cardNumber: z.string(),
  status: VisitorPassStatus,
  origin: VisitorPassOrigin,
  /** Prints and reprints made by this system (recording doesn't count). */
  printCount: z.number().int(),
  lastPrintedAt: z.coerce.date().nullable(),
  holder: z
    .object({
      visitId: z.string().uuid(),
      visitorName: z.string(),
      assignedAt: z.coerce.date().nullable(),
    })
    .nullable(),
  createdAt: z.coerce.date(),
});
export type VisitorPassItem = z.infer<typeof VisitorPassItem>;

export const VisitorPassPrintEntry = z.object({
  id: z.string().uuid(),
  kind: PassPrintKind,
  batchId: z.string().nullable(),
  note: z.string().nullable(),
  actorName: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type VisitorPassPrintEntry = z.infer<typeof VisitorPassPrintEntry>;

export const VisitorPassDetail = VisitorPassItem.extend({
  /** Newest first. */
  prints: z.array(VisitorPassPrintEntry),
  returnedAt: z.coerce.date().nullable(),
  retiredAt: z.coerce.date().nullable(),
  retireNote: z.string().nullable(),
});
export type VisitorPassDetail = z.infer<typeof VisitorPassDetail>;

export const VisitorPassSummary = z.object({
  total: z.number().int(),
  available: z.number().int(),
  inUse: z.number().int(),
  retired: z.number().int(),
});
export type VisitorPassSummary = z.infer<typeof VisitorPassSummary>;

/** Create new passes, numbered after each floor-wing's highest; printed separately. */
export const CreatePassesInput = z.object({
  items: z
    .array(z.object({ zone: Zone, quantity: z.number().int().min(1).max(500) }))
    .min(1)
    .max(40),
});
export type CreatePassesInput = z.infer<typeof CreatePassesInput>;

export const CreatePassesResult = z.object({
  batchId: z.string().uuid(),
  passes: z.array(VisitorPassItem),
});
export type CreatePassesResult = z.infer<typeof CreatePassesResult>;

/** Passes that physically exist but were printed before this system. */
export const RecordPassesInput = z
  .object({
    zone: Zone,
    from: z.number().int().min(1).max(9999),
    to: z.number().int().min(1).max(9999),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.to >= v.from, {
    path: ["to"],
    message: "To must be at least From",
  })
  .refine((v) => v.to - v.from < 500, {
    path: ["to"],
    message: "Record at most 500 passes at a time",
  });
export type RecordPassesInput = z.infer<typeof RecordPassesInput>;

export const RecordPassesResult = z.object({
  created: z.number().int(),
  /** Pass IDs that already exist on that floor-wing. */
  skipped: z.array(z.string()),
});
export type RecordPassesResult = z.infer<typeof RecordPassesResult>;

export const MarkPassesPrintedInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  batchId: z.string().uuid().optional(),
});
export type MarkPassesPrintedInput = z.infer<typeof MarkPassesPrintedInput>;

export const RetirePassInput = z.object({
  note: z.string().trim().max(500).optional(),
});
export type RetirePassInput = z.infer<typeof RetirePassInput>;

export const PassDemandQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
});
export type PassDemandQuery = z.infer<typeof PassDemandQuery>;

/** Per floor-wing: visitor traffic over the window vs passes in stock. */
export const PassDemandRow = z.object({
  zone: z.string(),
  visits: z.number().int(),
  /** In service (not retired), whether free or handed out. */
  stock: z.number().int(),
  inUse: z.number().int(),
});
export type PassDemandRow = z.infer<typeof PassDemandRow>;
