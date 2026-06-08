import { z } from "zod";

/**
 * Cross-cutting enums shared by the frontend and backend. These are the single
 * source of truth for status/lifecycle values — the Prisma schema, API DTOs,
 * and UI all derive from these so a value can never drift between layers.
 */

export const Locale = z.enum(["EN", "FR", "AR"]);
export type Locale = z.infer<typeof Locale>;

export const AuthProvider = z.enum(["LOCAL", "OIDC"]);
export type AuthProvider = z.infer<typeof AuthProvider>;

export const VisitType = z.enum(["WALK_IN", "PRE_INVITED", "APPOINTMENT"]);
export type VisitType = z.infer<typeof VisitType>;

export const VisitStatus = z.enum([
  "PENDING",
  "APPROVED",
  "DENIED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "EXPIRED",
]);
export type VisitStatus = z.infer<typeof VisitStatus>;

export const PassStatus = z.enum([
  "ISSUED",
  "ACTIVE",
  "RETURNED",
  "REVOKED",
  "EXPIRED",
]);
export type PassStatus = z.infer<typeof PassStatus>;

export const InvitationStatus = z.enum([
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
]);
export type InvitationStatus = z.infer<typeof InvitationStatus>;

export const RiskLevel = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const AlertStatus = z.enum([
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "DISMISSED",
]);
export type AlertStatus = z.infer<typeof AlertStatus>;

export const GateEventType = z.enum([
  "QR_SCAN",
  "APPOINTMENT_VERIFY",
  "INVITATION_VERIFY",
  "ACCESS_GRANTED",
  "ACCESS_DENIED",
]);
export type GateEventType = z.infer<typeof GateEventType>;

export const AttendanceType = z.enum([
  "SHIFT_START",
  "SHIFT_END",
  "BREAK_START",
  "BREAK_END",
]);
export type AttendanceType = z.infer<typeof AttendanceType>;

export const NotificationChannel = z.enum(["EMAIL", "SMS", "IN_APP"]);
export type NotificationChannel = z.infer<typeof NotificationChannel>;
