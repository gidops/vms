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
  VISIT_CHECK_IN: "visit:check_in",
  VISIT_CHECK_OUT: "visit:check_out",
  VISITOR_REGISTER: "visitor:register",
  INVITATION_CREATE: "invitation:create",
  ALERT_ESCALATE: "alert:escalate",
} as const;
