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
} as const;

/**
 * Canonical role names. Roles are stored as free strings in the DB, but these
 * constants keep the seeder, guards, and frontend in sync. A user may hold many
 * roles at once; the "active role" scopes the session's permissions + dashboard.
 */
export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  AUDITOR: "AUDITOR",
  STAFF: "STAFF",
  VMC: "VMC",
  GATE: "GATE",
} as const;
export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** Where each role lands after login / on role switch. */
export const ROLE_HOME: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: "/admin",
  [ROLES.ADMIN]: "/admin",
  [ROLES.AUDITOR]: "/admin",
  [ROLES.VMC]: "/dashboard",
  [ROLES.STAFF]: "/staff",
  [ROLES.GATE]: "/gate",
};

/** Resolve the home route for a role, falling back to the dashboard. */
export function homeFor(role: string | null | undefined): string {
  return (role && ROLE_HOME[role]) || "/dashboard";
}
