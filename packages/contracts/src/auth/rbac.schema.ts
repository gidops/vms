import { z } from "zod";

/**
 * Permission keys follow a `resource:action` convention and are the atoms that
 * roles are composed from. The backend's PermissionsGuard checks these; the
 * frontend uses the same keys to gate UI affordances.
 */
export const PermissionKey = z
  .string()
  .regex(/^[a-z]+:[a-z_]+$/, "permission must be in the form resource:action");
export type PermissionKey = z.infer<typeof PermissionKey>;

export const Permission = z.object({
  id: z.string().uuid(),
  key: PermissionKey,
  description: z.string().optional(),
});
export type Permission = z.infer<typeof Permission>;

export const Role = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(PermissionKey).default([]),
});
export type Role = z.infer<typeof Role>;

/** Well-known permission keys used across the platform. */
export const PERMISSIONS = {
  VISIT_APPROVE: "visit:approve",
  VISIT_DENY: "visit:deny",
  VISIT_CANCEL: "visit:cancel",
  VISIT_EDIT: "visit:edit",
  VISIT_CHECK_IN: "visit:check_in",
  VISIT_CHECK_OUT: "visit:check_out",
  /** Security Manager/admin flags a visit as a security concern (creates a SECURITY_REVIEW alert). */
  VISIT_FLAG: "visit:flag",
  /** Security Manager/admin requests more information (creates an ADDITIONAL_INFO alert). */
  VISIT_REQUEST_INFO: "visit:request_info",
  VISITOR_REGISTER: "visitor:register",
  INVITATION_CREATE: "invitation:create",
  ALERT_ESCALATE: "alert:escalate",
  ALERT_RESOLVE: "alert:resolve",
  NOTE_ADD: "note:add",
  USER_READ: "user:read",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  ROLE_READ: "role:read",
  /**
   * Read every visit (lists + detail). Holders without it are limited to the
   * visits they created or host (the staff "mine" scope).
   */
  VISIT_READ: "visit:read",
  /** QR issuers (staff self-registration codes): view / manage. */
  ISSUER_READ: "issuer:read",
  ISSUER_MANAGE: "issuer:manage",
  /** Live Evacuation Roll (checked-in visitors who need evacuation help). */
  EVACUATION_READ: "evacuation:read",
  /** Email consent: view the list, bulk-export it (personal data), withdraw consent. */
  CONSENT_READ: "consent:read",
  CONSENT_EXPORT: "consent:export",
  CONSENT_MANAGE: "consent:manage",
  /** Record consent on a visitor's behalf (opt them back in). System Admin only. */
  CONSENT_GRANT: "consent:grant",
  /** Admin Analytics & Reports page (aggregate visitor trends; no personal data). */
  REPORT_READ: "report:read",
  /** Bulk visitor export (CSV / Excel) — personal data. */
  REPORT_EXPORT: "report:export",
  /** Insights → Overview: today's facility-wide stats + who is on site. */
  OVERVIEW_READ: "overview:read",
  /** Insights → History across the whole facility (not just the caller's visits). */
  HISTORY_READ: "history:read",
  /** Insights → Visitors directory across the whole facility. */
  VISITOR_READ: "visitor:read",
  /** Insights History / Visitors / Analytics limited to the caller's own visits. */
  INSIGHTS_SELF: "insights:self",
  /**
   * Operations → Access cards: assign, print and close personalised RFID
   * access cards. System Admin only (no scoped role is given it).
   */
  RFID_MANAGE: "rfid:manage",
  /** Operations → Audit trail: read every audit row. System Admin only. */
  AUDIT_READ: "audit:read",
  /** Export the audit trail as CSV. System Admin only. */
  AUDIT_EXPORT: "audit:export",
  /** Per-visit notification delivery status (Guest Details → Notifications). */
  NOTIFICATION_READ: "notification:read",
  /** Re-queue a failed email / SMS / WhatsApp notification. */
  NOTIFICATION_RETRY: "notification:retry",
} as const;

/**
 * Canonical role names. Roles are stored as free strings in the DB, but these
 * constants keep the seeder, guards, and frontend in sync. A user may hold many
 * roles at once; the "active role" scopes the session's permissions + dashboard.
 */
export const ROLES = {
  /** Displayed as "System Admin". */
  SUPER_ADMIN: "SUPER_ADMIN",
  /** Displayed as "Security Manager". */
  ADMIN: "ADMIN",
  /** Add-on for VMC: visitor directory + analytics on the Insights page. */
  VMC_ADMIN: "VMC_ADMIN",
  /** Add-on for STAFF: facility-wide Insights (read only; no bulk exports). */
  READ_ADMIN: "READ_ADMIN",
  STAFF: "STAFF",
  VMC: "VMC",
  GATE: "GATE",
} as const;
export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** Where each role lands after login / on role switch. */
export const ROLE_HOME: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: "/admin",
  [ROLES.ADMIN]: "/admin",
  [ROLES.VMC]: "/dashboard",
  [ROLES.STAFF]: "/staff",
  [ROLES.GATE]: "/gate",
};

/** Resolve the home route for a role, falling back to the dashboard. */
export function homeFor(role: string | null | undefined): string {
  return (role && ROLE_HOME[role]) || "/dashboard";
}

/**
 * Add-on roles → the base role they extend. An add-on is never "active" (it is
 * not offered in the role switcher and has no home); its permissions are merged
 * into the session while the user is acting as its base role.
 */
export const ADDON_ROLES: Record<string, string> = {
  [ROLES.READ_ADMIN]: ROLES.STAFF,
  [ROLES.VMC_ADMIN]: ROLES.VMC,
};

export function isAddonRole(role: string): boolean {
  return role in ADDON_ROLES;
}

/** The roles a user can switch between (add-ons excluded). */
export function switchableRoles(roles: readonly string[]): string[] {
  return roles.filter((r) => !isAddonRole(r));
}
