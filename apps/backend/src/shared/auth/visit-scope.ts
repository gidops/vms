import { PERMISSIONS, ROLES } from '@vms/contracts';
import type { AuthUser } from './auth.decorators';

/**
 * Roles that read every visit before `visit:read` existed. Access tokens minted
 * before the permission was seeded don't carry it, so these roles keep read-all
 * until their token rotates (≤ access-token TTL).
 * TODO(remove next release): drop once pre-`visit:read` tokens have expired.
 */
const LEGACY_READ_ALL_ROLES: readonly string[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.AUDITOR,
  ROLES.VMC,
];

/**
 * Whether a principal may read every visit / inbox item. Everyone else (staff,
 * gate) is limited to visits they created or host.
 */
export function canReadAllVisits(principal: AuthUser): boolean {
  if (principal.permissions.includes(PERMISSIONS.VISIT_READ)) return true;
  // Permissions are scoped to the active role, so the fallback is too; legacy
  // tokens without an active role fall back to every role held.
  const roles = principal.activeRole ? [principal.activeRole] : principal.roles;
  return roles.some((r) => LEGACY_READ_ALL_ROLES.includes(r));
}
