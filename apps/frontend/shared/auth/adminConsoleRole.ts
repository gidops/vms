import { PERMISSIONS } from "@vms/contracts";

/** Read from permissions, not the role name, so a custom role lands sensibly. */
export type AdminConsoleRole = "securityManager" | "systemAdmin";

export function adminConsoleRole(
  hasPermission: (permission: string) => boolean,
): AdminConsoleRole {
  return hasPermission(PERMISSIONS.VISIT_APPROVE) &&
    !hasPermission(PERMISSIONS.USER_READ)
    ? "securityManager"
    : "systemAdmin";
}
