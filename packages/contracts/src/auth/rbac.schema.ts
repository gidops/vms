import { z } from "zod";

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

export const PERMISSIONS = {
  VISIT_APPROVE: "visit:approve",
  VISIT_DENY: "visit:deny",
  VISIT_CANCEL: "visit:cancel",
  VISIT_EDIT: "visit:edit",
  VISIT_CHECK_IN: "visit:check_in",
  VISIT_CHECK_OUT: "visit:check_out",
  VISIT_FLAG: "visit:flag",
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
  /** Without it, reads are limited to visits the user created or hosts. */
  VISIT_READ: "visit:read",
  ISSUER_READ: "issuer:read",
  ISSUER_MANAGE: "issuer:manage",
  EVACUATION_READ: "evacuation:read",
  CONSENT_READ: "consent:read",
  CONSENT_EXPORT: "consent:export",
  CONSENT_MANAGE: "consent:manage",
  /** System Admin only. */
  CONSENT_GRANT: "consent:grant",
  REPORT_READ: "report:read",
  REPORT_EXPORT: "report:export",
  OVERVIEW_READ: "overview:read",
  HISTORY_READ: "history:read",
  VISITOR_READ: "visitor:read",
  INSIGHTS_SELF: "insights:self",
  /** System Admin only. */
  RFID_MANAGE: "rfid:manage",
  /** System Admin only. */
  AUDIT_READ: "audit:read",
  /** System Admin only. */
  AUDIT_EXPORT: "audit:export",
  NOTIFICATION_READ: "notification:read",
  NOTIFICATION_RETRY: "notification:retry",
} as const;

/** Stored as free strings in the DB; the active role scopes session permissions. */
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

export const ROLE_HOME: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: "/admin",
  [ROLES.ADMIN]: "/admin",
  [ROLES.VMC]: "/dashboard",
  [ROLES.STAFF]: "/staff",
  [ROLES.GATE]: "/gate",
};

export function homeFor(role: string | null | undefined): string {
  return (role && ROLE_HOME[role]) || "/dashboard";
}

/** Add-on → base role; add-on permissions merge in while acting as the base role. */
export const ADDON_ROLES: Record<string, string> = {
  [ROLES.READ_ADMIN]: ROLES.STAFF,
  [ROLES.VMC_ADMIN]: ROLES.VMC,
};

export function isAddonRole(role: string): boolean {
  return role in ADDON_ROLES;
}

export function switchableRoles(roles: readonly string[]): string[] {
  return roles.filter((r) => !isAddonRole(r));
}
