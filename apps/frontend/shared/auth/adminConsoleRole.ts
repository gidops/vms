import { PERMISSIONS } from "@vms/contracts";

/**
 * Which admin console the caller gets. The Security Manager decides visit
 * requests but holds no user:read; the System Admin holds every permission.
 * Read from permissions, not the role name, so a custom role lands sensibly.
 */
export type AdminConsoleRole = "securityManager" | "systemAdmin";

export function adminConsoleRole(
  hasPermission: (permission: string) => boolean,
): AdminConsoleRole {
  return hasPermission(PERMISSIONS.VISIT_APPROVE) &&
    !hasPermission(PERMISSIONS.USER_READ)
    ? "securityManager"
    : "systemAdmin";
}
