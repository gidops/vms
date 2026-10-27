import { z } from "zod";

// Single source of truth: the Prisma enums and backend DTOs mirror these.

export const Locale = z.enum(["EN", "FR", "AR"]);
export type Locale = z.infer<typeof Locale>;

export const AuthProvider = z.enum(["LOCAL", "OIDC"]);
export type AuthProvider = z.infer<typeof AuthProvider>;

export const VisitType = z.enum(["WALK_IN", "PRE_INVITED", "APPOINTMENT"]);
export type VisitType = z.infer<typeof VisitType>;

export const VisitStatus = z.enum([
  "PENDING",
  /** Host responds via notes and resubmits to PENDING. */
  "REVIEW_REQUESTED",
  /** Check-in is blocked until the alert is resolved. */
  "FLAGGED",
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

/** Raised only by the Security Manager or the system; staff/VMC cannot resolve them. */
export const AlertType = z.enum([
  "SECURITY_REVIEW",
  "ADDITIONAL_INFO",
  "RESTRICTED_MATCH",
]);
export type AlertType = z.infer<typeof AlertType>;

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

export const NotificationChannel = z.enum([
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "IN_APP",
]);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const NotificationStatus = z.enum(["PENDING", "SENT", "FAILED"]);
export type NotificationStatus = z.infer<typeof NotificationStatus>;
