import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ADDON_ROLES, ROLES } from '@vms/contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UsersService } from './../src/modules/identity/users.service';

/**
 * Insights page end to end: which role reaches which tab's endpoint, the
 * facility vs self scope of History / Visitors / Analytics, add-on roles that
 * extend (and never replace) their base role, and the PDF export.
 */
jest.setTimeout(30_000);

describe('Insights (e2e)', () => {
  let app: INestApplication<App>;
  const run = Date.now();
  const password = 'Passw0rd!';
  const tokens: Record<string, string> = {};
  const userIds: Record<string, string> = {};
  const roles = [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.VMC_ADMIN,
    ROLES.READ_ADMIN,
    ROLES.VMC,
    ROLES.STAFF,
  ];

  const http = () => request(app.getHttpServer());
  const as = (role: string) => ({
    get: (url: string) =>
      http().get(url).set('Authorization', `Bearer ${tokens[role]}`),
    post: (url: string) =>
      http().post(url).set('Authorization', `Bearer ${tokens[role]}`),
  });

  const guest = (email: string, over: Record<string, unknown> = {}) => ({
    fullName: `Guest ${email}`,
    email,
    organization: 'Org',
    floor: '4th Floor',
    purpose: 'Official',
    needsEvacuationAssist: false,
    commsConsent: false,
    ...over,
  });

  async function walkIn(email: string, over: Record<string, unknown> = {}) {
    const res = await as(ROLES.VMC)
      .post('/visits')
      .send({ type: 'WALK_IN', guests: [guest(email, over)] })
      .expect(201);
    return res.body[0] as { id: string; visitor: { id: string } };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    const users = app.get(UsersService);
    for (const role of roles) {
      const email = `insights-${role.toLowerCase()}-${run}@test.local`;
      const u = await users.create({
        email,
        fullName: `Insights ${role} ${run}`,
        password,
        // Add-ons only extend their base role, so hold both.
        roles: ADDON_ROLES[role] ? [ADDON_ROLES[role], role] : [role],
      });
      userIds[role] = u.id;
      const login = await http()
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      tokens[role] = login.body.tokens.accessToken as string;
    }
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  describe('add-on roles', () => {
    it('sign in as the base role and cannot be switched to', async () => {
      for (const [addon, base] of Object.entries(ADDON_ROLES)) {
        const me = await as(addon).get('/users/me').expect(200);
        expect(me.body.activeRole).toBe(base);
        await as(addon)
          .post('/auth/switch-role')
          .send({ role: addon })
          .expect(400);
      }
    });

    it('rejects an add-on without its base role', async () => {
      await as(ROLES.SUPER_ADMIN)
        .post('/users')
        .send({
          email: `lonely-${run}@test.local`,
          fullName: 'Lonely',
          password,
          roles: [ROLES.READ_ADMIN],
        })
        .expect(400);
    });
  });

  describe('tab matrix', () => {
    const matrix: [string, Record<string, number>][] = [
      [
        '/insights/overview',
        {
          SUPER_ADMIN: 200,
          READ_ADMIN: 200,
          ADMIN: 403,
          VMC_ADMIN: 403,
          VMC: 403,
          STAFF: 403,
        },
      ],
      [
        '/visits/evacuation-roll',
        {
          SUPER_ADMIN: 200,
          ADMIN: 200,
          VMC_ADMIN: 200,
          VMC: 200,
          READ_ADMIN: 403,
          STAFF: 403,
        },
      ],
      [
        '/insights/history',
        {
          SUPER_ADMIN: 200,
          ADMIN: 200,
          READ_ADMIN: 200,
          VMC_ADMIN: 200,
          VMC: 200,
          STAFF: 200,
        },
      ],
      [
        '/insights/visitors',
        {
          SUPER_ADMIN: 200,
          ADMIN: 200,
          READ_ADMIN: 200,
          VMC_ADMIN: 200,
          STAFF: 200,
          VMC: 403,
        },
      ],
      [
        '/insights/analytics?range=7d',
        {
          SUPER_ADMIN: 200,
          ADMIN: 200,
          READ_ADMIN: 200,
          VMC_ADMIN: 200,
          STAFF: 200,
          VMC: 403,
        },
      ],
    ];
    for (const [url, expected] of matrix) {
      for (const [role, status] of Object.entries(expected)) {
        it(`GET ${url.split('?')[0]} → ${role} ${status}`, async () => {
          await as(role).get(url).expect(status);
        });
      }
    }
  });

  describe('scope', () => {
    let hosted: { id: string; visitor: { id: string } };
    let other: { id: string; visitor: { id: string } };

    beforeAll(async () => {
      hosted = await walkIn(`ins-hosted-${run}@x.com`, {
        hostUserId: userIds[ROLES.STAFF],
      });
      other = await walkIn(`ins-other-${run}@x.com`);
    });

    const ids = (body: { items: { id: string }[] }) =>
      body.items.map((i) => i.id);

    it('limits staff history to their own visits', async () => {
      const staff = await as(ROLES.STAFF)
        .get('/insights/history?pageSize=100&sortBy=createdAt')
        .expect(200);
      expect(ids(staff.body)).toContain(hosted.id);
      expect(ids(staff.body)).not.toContain(other.id);

      const readAdmin = await as(ROLES.READ_ADMIN)
        .get('/insights/history?pageSize=100&sortBy=createdAt')
        .expect(200);
      expect(ids(readAdmin.body)).toEqual(
        expect.arrayContaining([hosted.id, other.id]),
      );
    });

    it("lets Read Admin open any visit, but not widen staff's own lists", async () => {
      await as(ROLES.READ_ADMIN).get(`/visits/${other.id}`).expect(200);
      await as(ROLES.STAFF).get(`/visits/${other.id}`).expect(404);
      const list = await as(ROLES.READ_ADMIN)
        .get('/visits?pageSize=100')
        .expect(200);
      expect(ids(list.body)).not.toContain(other.id);
    });

    it('limits the staff visitor directory to people who came to see them', async () => {
      const search = `?search=${encodeURIComponent(`ins-`)}&pageSize=100`;
      const staff = await as(ROLES.STAFF)
        .get(`/insights/visitors${search}`)
        .expect(200);
      expect(ids(staff.body)).toContain(hosted.visitor.id);
      expect(ids(staff.body)).not.toContain(other.visitor.id);
      await as(ROLES.STAFF)
        .get(`/insights/visitors/${other.visitor.id}`)
        .expect(404);

      const vmcAdmin = await as(ROLES.VMC_ADMIN)
        .get(`/insights/visitors/${other.visitor.id}`)
        .expect(200);
      expect(vmcAdmin.body.visitCount).toBe(1);
    });

    it('returns personal analytics for staff and security trends for the Security Manager', async () => {
      const staff = await as(ROLES.STAFF)
        .get('/insights/analytics?range=7d')
        .expect(200);
      expect(staff.body.scope).toBe('self');
      expect(staff.body.security).toBeNull();
      expect(staff.body.topHosts).toEqual([]);

      const sm = await as(ROLES.ADMIN)
        .get('/insights/analytics?range=30d')
        .expect(200);
      expect(sm.body.scope).toBe('facility');
      expect(sm.body.daily).toHaveLength(30);
      expect(sm.body.security).not.toBeNull();
    });
  });

  it('exports history as a PDF for exporters only', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const url = `/visits/export?from=${today}&to=${today}&format=pdf`;
    const res = await as(ROLES.VMC)
      .get(url)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    await as(ROLES.READ_ADMIN).get(url).expect(403);
  });
});
