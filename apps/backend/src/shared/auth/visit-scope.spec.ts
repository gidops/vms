import { PERMISSIONS } from '@vms/contracts';
import type { AuthUser } from './auth.decorators';
import { canReadAllVisits } from './visit-scope';

const principal = (over: Partial<AuthUser> = {}): AuthUser => ({
  userId: 'u1',
  email: 'u1@aatc.org',
  roles: [],
  activeRole: null,
  permissions: [],
  ...over,
});

describe('canReadAllVisits', () => {
  it('allows principals holding visit:read', () => {
    expect(
      canReadAllVisits(
        principal({
          roles: ['STAFF'],
          activeRole: 'STAFF',
          permissions: [PERMISSIONS.VISIT_READ],
        }),
      ),
    ).toBe(true);
  });

  it('allows legacy read-all roles whose token predates visit:read', () => {
    expect(
      canReadAllVisits(principal({ roles: ['VMC'], activeRole: 'VMC' })),
    ).toBe(true);
    expect(canReadAllVisits(principal({ roles: ['ADMIN'] }))).toBe(true);
  });

  it('limits staff', () => {
    expect(
      canReadAllVisits(principal({ roles: ['STAFF'], activeRole: 'STAFF' })),
    ).toBe(false);
  });

  it('scopes the fallback to the active role', () => {
    expect(
      canReadAllVisits(
        principal({ roles: ['ADMIN', 'STAFF'], activeRole: 'STAFF' }),
      ),
    ).toBe(false);
  });
});
