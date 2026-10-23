import { PERMISSIONS, ROLES } from '@vms/contracts';
import { SCOPED_ROLE_DEFS } from './seeder.service';

const has = (role: string, perm: string) =>
  SCOPED_ROLE_DEFS[role].permissions.includes(perm);

describe('Role → permission matrix (V1 gap features)', () => {
  const PII_EXPORTS = [PERMISSIONS.REPORT_EXPORT, PERMISSIONS.CONSENT_EXPORT];

  it('defines the two new admin roles', () => {
    expect(SCOPED_ROLE_DEFS[ROLES.VMC_ADMIN]).toBeDefined();
    expect(SCOPED_ROLE_DEFS[ROLES.READ_ADMIN]).toBeDefined();
  });

  it('limits bulk personal-data export to the Security Manager and reception (System Admin gets everything)', () => {
    const exporters = new Set<string>([
      ROLES.ADMIN,
      ROLES.VMC,
      ROLES.VMC_ADMIN,
    ]);
    for (const role of Object.keys(SCOPED_ROLE_DEFS)) {
      for (const perm of PII_EXPORTS) {
        expect([role, perm, has(role, perm)]).toEqual([
          role,
          perm,
          exporters.has(role),
        ]);
      }
    }
  });

  it('keeps Read Admin strictly read-only', () => {
    for (const perm of SCOPED_ROLE_DEFS[ROLES.READ_ADMIN].permissions) {
      expect(perm).toMatch(/:read$/);
    }
  });

  it('grants the Evacuation Roll to reception, admins, auditors and the gate — not staff', () => {
    for (const role of [
      ROLES.VMC,
      ROLES.ADMIN,
      ROLES.VMC_ADMIN,
      ROLES.READ_ADMIN,
      ROLES.AUDITOR,
      ROLES.GATE,
    ]) {
      expect([role, has(role, PERMISSIONS.EVACUATION_READ)]).toEqual([
        role,
        true,
      ]);
    }
    expect(has(ROLES.STAFF, PERMISSIONS.EVACUATION_READ)).toBe(false);
  });

  it('withholds visit:read from staff and gate so their visit reads stay scoped', () => {
    expect(has(ROLES.STAFF, PERMISSIONS.VISIT_READ)).toBe(false);
    expect(has(ROLES.GATE, PERMISSIONS.VISIT_READ)).toBe(false);
    for (const role of [
      ROLES.VMC,
      ROLES.ADMIN,
      ROLES.VMC_ADMIN,
      ROLES.READ_ADMIN,
      ROLES.AUDITOR,
    ]) {
      expect([role, has(role, PERMISSIONS.VISIT_READ)]).toEqual([role, true]);
    }
  });

  it('lets reception view, withdraw and export opt-ins (V1 parity)', () => {
    expect(has(ROLES.VMC, PERMISSIONS.CONSENT_READ)).toBe(true);
    expect(has(ROLES.VMC, PERMISSIONS.CONSENT_MANAGE)).toBe(true);
    expect(has(ROLES.VMC, PERMISSIONS.CONSENT_EXPORT)).toBe(true);
    expect(has(ROLES.VMC_ADMIN, PERMISSIONS.CONSENT_EXPORT)).toBe(true);
    expect(has(ROLES.READ_ADMIN, PERMISSIONS.CONSENT_EXPORT)).toBe(false);
    expect(has(ROLES.AUDITOR, PERMISSIONS.CONSENT_EXPORT)).toBe(false);
    expect(has(ROLES.READ_ADMIN, PERMISSIONS.CONSENT_MANAGE)).toBe(false);
    expect(has(ROLES.AUDITOR, PERMISSIONS.CONSENT_MANAGE)).toBe(false);
  });

  it('opens Analytics & Reports to every admin console role and auditors only', () => {
    const readers = new Set<string>([
      ROLES.ADMIN,
      ROLES.VMC_ADMIN,
      ROLES.READ_ADMIN,
      ROLES.AUDITOR,
    ]);
    for (const role of Object.keys(SCOPED_ROLE_DEFS)) {
      expect([role, has(role, PERMISSIONS.REPORT_READ)]).toEqual([
        role,
        readers.has(role),
      ]);
    }
  });

  it('only uses permission keys from the catalogue', () => {
    const catalogue = new Set<string>(Object.values(PERMISSIONS));
    for (const def of Object.values(SCOPED_ROLE_DEFS)) {
      for (const p of def.permissions) expect(catalogue.has(p)).toBe(true);
    }
  });
});
