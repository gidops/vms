import { PERMISSIONS, ROLES } from '@vms/contracts';
import type { AuthUser } from './auth.decorators';

/**
 * Tokens minted before `visit:read` was seeded lack it; these roles keep read-all until rotation.
 * TODO(remove next release): drop once pre-`visit:read` tokens have expired.
 */
const LEGACY_READ_ALL_ROLES: readonly string[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.VMC,
];

export function canReadAllVisits(principal: AuthUser): boolean {
  if (principal.permissions.includes(PERMISSIONS.VISIT_READ)) return true;
  // Tokens without an active role fall back to every role held.
  const roles = principal.activeRole ? [principal.activeRole] : principal.roles;
  return roles.some((r) => LEGACY_READ_ALL_ROLES.includes(r));
}
