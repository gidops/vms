import { ADDON_ROLES, PERMISSIONS, ROLES } from '@vms/contracts';
import { SCOPED_ROLE_DEFS } from './seeder.service';

const has = (role: string, perm: string) =>
  SCOPED_ROLE_DEFS[role].permissions.includes(perm);

/** What a session acting as `role` holds: an add-on is merged with its base. */
const holds = (role: string, perm: string) =>
  has(role, perm) || (ADDON_ROLES[role] ? has(ADDON_ROLES[role], perm) : false);

describe('Role → permission matrix', () => {
  const PII_EXPORTS = [PERMISSIONS.REPORT_EXPORT, PERMISSIONS.CONSENT_EXPORT];

  it('defines both add-on roles on top of an existing base role', () => {
    for (const [addon, base] of Object.entries(ADDON_ROLES)) {
      expect(SCOPED_ROLE_DEFS[addon]).toBeDefined();
      expect(SCOPED_ROLE_DEFS[base]).toBeDefined();
    }
  });

  it('limits bulk personal-data export to the Security Manager and reception (System Admin gets everything)', () => {
    const exporters = new Set<string>([ROLES.ADMIN, ROLES.VMC]);
    for (const role of Object.keys(SCOPED_ROLE_DEFS)) {
      for (const perm of PII_EXPORTS) {
        expect([role, perm, has(role, perm)]).toEqual([
          role,
          perm,
          exporters.has(role),
        ]);
      }
    }
    // VMC Admin keeps export through its VMC base; Read Admin never gets it.
    expect(holds(ROLES.VMC_ADMIN, PERMISSIONS.REPORT_EXPORT)).toBe(true);
    expect(holds(ROLES.READ_ADMIN, PERMISSIONS.REPORT_EXPORT)).toBe(false);
  });

  it('keeps Read Admin strictly read-only', () => {
    for (const perm of SCOPED_ROLE_DEFS[ROLES.READ_ADMIN].permissions) {
      expect(perm).toMatch(/:read$/);
    }
  });

  it('grants the Evacuation Roll to reception, the Security Manager and the gate — not staff or Read Admin', () => {
    for (const role of [ROLES.VMC, ROLES.ADMIN, ROLES.VMC_ADMIN, ROLES.GATE]) {
      expect([role, holds(role, PERMISSIONS.EVACUATION_READ)]).toEqual([
        role,
        true,
      ]);
    }
    expect(holds(ROLES.STAFF, PERMISSIONS.EVACUATION_READ)).toBe(false);
    expect(holds(ROLES.READ_ADMIN, PERMISSIONS.EVACUATION_READ)).toBe(false);
  });

  it('withholds visit:read from staff, Read Admin and gate so their visit reads stay scoped', () => {
    for (const role of [ROLES.STAFF, ROLES.READ_ADMIN, ROLES.GATE]) {
      expect([role, holds(role, PERMISSIONS.VISIT_READ)]).toEqual([
        role,
        false,
      ]);
    }
    for (const role of [ROLES.VMC, ROLES.ADMIN, ROLES.VMC_ADMIN]) {
      expect([role, holds(role, PERMISSIONS.VISIT_READ)]).toEqual([role, true]);
    }
  });

  it('lets reception view, withdraw and export opt-ins (V1 parity)', () => {
    expect(has(ROLES.VMC, PERMISSIONS.CONSENT_READ)).toBe(true);
    expect(has(ROLES.VMC, PERMISSIONS.CONSENT_MANAGE)).toBe(true);
    expect(has(ROLES.VMC, PERMISSIONS.CONSENT_EXPORT)).toBe(true);
    expect(holds(ROLES.VMC_ADMIN, PERMISSIONS.CONSENT_MANAGE)).toBe(true);
    expect(holds(ROLES.READ_ADMIN, PERMISSIONS.CONSENT_EXPORT)).toBe(false);
    expect(holds(ROLES.READ_ADMIN, PERMISSIONS.CONSENT_MANAGE)).toBe(false);
  });

  it('matches the Insights tab matrix', () => {
    const tab = {
      overview: [PERMISSIONS.OVERVIEW_READ],
      evacuation: [PERMISSIONS.EVACUATION_READ],
      history: [PERMISSIONS.HISTORY_READ, PERMISSIONS.INSIGHTS_SELF],
      visitors: [PERMISSIONS.VISITOR_READ, PERMISSIONS.INSIGHTS_SELF],
      analytics: [PERMISSIONS.REPORT_READ, PERMISSIONS.INSIGHTS_SELF],
    };
    const tabsFor = (role: string) =>
      Object.entries(tab)
        .filter(([, perms]) => perms.some((p) => holds(role, p)))
        .map(([name]) => name);

    expect(tabsFor(ROLES.STAFF)).toEqual(['history', 'visitors', 'analytics']);
    expect(tabsFor(ROLES.READ_ADMIN)).toEqual([
      'overview',
      'history',
      'visitors',
      'analytics',
    ]);
    expect(tabsFor(ROLES.VMC)).toEqual(['evacuation', 'history']);
    expect(tabsFor(ROLES.VMC_ADMIN)).toEqual([
      'evacuation',
      'history',
      'visitors',
      'analytics',
    ]);
    expect(tabsFor(ROLES.GATE)).toEqual(['evacuation']);
    expect(tabsFor(ROLES.ADMIN)).toEqual([
      'evacuation',
      'history',
      'visitors',
      'analytics',
    ]);
  });

  it('keeps the desk QR to the System Admin (no scoped role holds issuer:*)', () => {
    for (const role of Object.keys(SCOPED_ROLE_DEFS)) {
      for (const perm of [PERMISSIONS.ISSUER_READ, PERMISSIONS.ISSUER_MANAGE]) {
        expect([role, perm, has(role, perm)]).toEqual([role, perm, false]);
      }
    }
  });

  it('only uses permission keys from the catalogue', () => {
    const catalogue = new Set<string>(Object.values(PERMISSIONS));
    for (const def of Object.values(SCOPED_ROLE_DEFS)) {
      for (const p of def.permissions) expect(catalogue.has(p)).toBe(true);
    }
  });
});
