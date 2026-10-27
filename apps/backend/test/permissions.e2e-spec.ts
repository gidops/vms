import { ROLES } from '@vms/contracts';
import { useRoleApp } from './support/role-app';

/** Which role may call which visit, consent, evacuation, delivery and export endpoint. */
jest.setTimeout(30_000);

describe('Permission matrix (e2e)', () => {
  const ctx = useRoleApp('perm');
  const { as, run } = ctx;

  describe('permission matrix', () => {
    const matrix: [string, string, Record<string, number>][] = [
      [
        'GET',
        '/visits/evacuation-roll',
        {
          SUPER_ADMIN: 200,
          ADMIN: 200,
          VMC_ADMIN: 200,
          READ_ADMIN: 403,
          VMC: 200,
          GATE: 200,
          STAFF: 403,
        },
      ],
      [
        'GET',
        '/visits/export?from=2026-10-17&to=2026-10-17&format=csv',
        {
          SUPER_ADMIN: 200,
          ADMIN: 200,
          VMC_ADMIN: 200,
          READ_ADMIN: 403,
          VMC: 200,
          GATE: 403,
          STAFF: 403,
        },
      ],
      [
        // Admin console overview counts: only roles that reach the console.
        'GET',
        '/visits/dashboard/stats?dateFrom=2026-10-18T23:00:00Z&dateTo=2026-10-19T22:59:59Z&yesterdayFrom=2026-10-17T23:00:00Z&yesterdayTo=2026-10-18T22:59:59Z',
        {
          SUPER_ADMIN: 200,
          ADMIN: 200,
          VMC_ADMIN: 403,
          READ_ADMIN: 403,
          VMC: 403,
          GATE: 403,
          STAFF: 403,
        },
      ],
      [
        // Reception's onsite / checked in / checked out numbers.
        'GET',
        '/visits/dashboard/desk-stats',
        {
          SUPER_ADMIN: 200,
          ADMIN: 403,
          VMC_ADMIN: 200,
          READ_ADMIN: 403,
          VMC: 200,
          GATE: 200,
          STAFF: 403,
        },
      ],
      [
        // Analytics-only chart, gated by report:read.
        'GET',
        '/visits/dashboard/traffic?dateFrom=2026-10-18T23:00:00Z&dateTo=2026-10-19T22:59:59Z&timeZone=Africa/Lagos',
        {
          SUPER_ADMIN: 200,
          ADMIN: 200,
          VMC_ADMIN: 200,
          READ_ADMIN: 200,
          VMC: 403,
          GATE: 403,
          STAFF: 403,
        },
      ],
      [
        // Users and roles are the System Admin's; the Security Manager has none.
        'GET',
        '/users',
        {
          SUPER_ADMIN: 200,
          ADMIN: 403,
          VMC_ADMIN: 403,
          READ_ADMIN: 403,
          VMC: 403,
          GATE: 403,
          STAFF: 403,
        },
      ],
      [
        'GET',
        '/roles',
        {
          SUPER_ADMIN: 200,
          ADMIN: 403,
          VMC: 403,
          STAFF: 403,
        },
      ],
      [
        'GET',
        '/consent/opt-ins',
        {
          SUPER_ADMIN: 200,
          ADMIN: 200,
          VMC_ADMIN: 200,
          READ_ADMIN: 200,
          VMC: 200,
          GATE: 403,
          STAFF: 403,
        },
      ],
      [
        'GET',
        '/consent/opt-ins.csv',
        {
          SUPER_ADMIN: 200,
          ADMIN: 200,
          VMC_ADMIN: 200,
          READ_ADMIN: 403,
          VMC: 200,
          GATE: 403,
          STAFF: 403,
        },
      ],
    ];
    for (const [method, url, expected] of matrix) {
      for (const [role, status] of Object.entries(expected)) {
        it(`${method} ${url.split('?')[0]} → ${role} ${status}`, async () => {
          await as(role).get(url).expect(status);
        });
      }
    }

    it('POST /consent/withdraw is limited to consent:manage holders', async () => {
      for (const role of [
        ROLES.ADMIN,
        ROLES.READ_ADMIN,
        ROLES.STAFF,
        ROLES.GATE,
      ]) {
        await as(role)
          .post('/consent/withdraw')
          .send({ email: 'x@y.com' })
          .expect(403);
      }
      for (const role of [ROLES.VMC, ROLES.VMC_ADMIN]) {
        await as(role)
          .post('/consent/withdraw')
          .send({ email: `nobody-${run}@y.com` })
          .expect(200)
          .expect({ affected: false });
      }
    });

    it('POST /consent/grant is limited to the System Admin', async () => {
      for (const role of [
        ROLES.VMC,
        ROLES.ADMIN,
        ROLES.VMC_ADMIN,
        ROLES.READ_ADMIN,
        ROLES.STAFF,
        ROLES.GATE,
      ]) {
        await as(role)
          .post('/consent/grant')
          .send({ email: 'x@y.com' })
          .expect(403);
      }
      await as(ROLES.SUPER_ADMIN)
        .post('/consent/grant')
        .send({ email: `nobody-${run}@y.com` })
        .expect(200)
        .expect({ affected: false });
    });

    it('rejects an export range over 366 days or reversed', async () => {
      await as(ROLES.ADMIN)
        .get('/visits/export?from=2025-01-01&to=2026-01-02&format=csv')
        .expect(400);
      await as(ROLES.ADMIN)
        .get('/visits/export?from=2026-10-18&to=2026-10-17&format=csv')
        .expect(400);
      await as(ROLES.ADMIN)
        .get('/visits/export?from=2025-01-02&to=2026-01-02&format=csv')
        .expect(200);
    });
  });
});
