import { z } from "zod";
import { VisitStatus } from "../common/enums.js";

/** Invitation reference code, e.g. `ABCD-123`: the payload of the emailed QR. */
export const REFERENCE_CODE_RE = /^[A-Z0-9]{4}-\d{3}$/;

/**
 * Tolerates how a code is typed or scanned: case, surrounding/inner spaces and
 * a missing or different dash (`abcd 123`, `ABCD123`) all become `ABCD-123`.
 * Anything that still isn't code-shaped is returned uppercased as-is.
 */
export function normalizeReferenceCode(raw: string): string {
  const compact = raw.toUpperCase().replace(/[\s\-–—_]/g, "");
  return /^[A-Z0-9]{4}\d{3}$/.test(compact)
    ? `${compact.slice(0, 4)}-${compact.slice(4)}`
    : raw.trim().toUpperCase();
}

/** How the code reached the gate: camera scan, or typed when the camera fails. */
export const GateVerifySource = z.enum(["scan", "manual"]);
export type GateVerifySource = z.infer<typeof GateVerifySource>;

export const GateVerifyInput = z.object({
  code: z.string().trim().min(1).max(64).transform(normalizeReferenceCode),
  source: GateVerifySource,
});
export type GateVerifyInput = z.infer<typeof GateVerifyInput>;

/**
 * The gate informs, it never blocks: every verdict ends with the visitor free
 * to go to the VMC. Security holds are deliberately not part of it.
 */
export const GateVerdict = z.enum([
  /** Approved and scheduled today (WAT): proceed to the VMC. */
  "VALID_TODAY",
  /** Already checked in at the VMC. */
  "ALREADY_CHECKED_IN",
  /** Approved, but scheduled for another day. */
  "WRONG_DAY",
  /** Still awaiting approval. */
  "NOT_CONFIRMED",
  /** Cancelled, denied, expired or already completed. */
  "CLOSED",
  /** No invitation with this code (walk-in codes included). */
  "NOT_FOUND",
]);
export type GateVerdict = z.infer<typeof GateVerdict>;

export const GateVisitSummary = z.object({
  visitorName: z.string(),
  organization: z.string().nullable(),
  hostName: z.string().nullable(),
  scheduledAt: z.coerce.date().nullable(),
  status: VisitStatus,
});
export type GateVisitSummary = z.infer<typeof GateVisitSummary>;

export const GateVerifyResult = z.object({
  verdict: GateVerdict,
  /** Absent for NOT_FOUND. */
  visit: GateVisitSummary.nullable(),
});
export type GateVerifyResult = z.infer<typeof GateVerifyResult>;

/** Kiosk link token: base64url like the Desk QR's (same length bounds). */
export const GATE_KIOSK_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** The System Admin's view of the gate kiosk link (the token only ever appears inside `url`). */
export const GateKioskView = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
  url: z.string().url(),
  tokenRotatedAt: z.coerce.date(),
  disabledAt: z.coerce.date().nullable(),
  lastScanAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  createdByName: z.string().nullable(),
});
export type GateKioskView = z.infer<typeof GateKioskView>;
