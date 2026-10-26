import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ADDON_ROLES, ROLES } from '@vms/contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UsersService } from './../src/modules/identity/users.service';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * V1-gap features end to end against a real database: the role/permission
 * matrix on every new endpoint, scoped visit reads, intake answers, the
 * Evacuation Roll, comms consent (latest answer wins, withdrawal), delivery
 * status + retry, and the WAT-bounded visitor export.
 */
jest.setTimeout(30_000);

describe('V1 gap features (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
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
    ROLES.GATE,
  ];

  const as = (role: string) => ({
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${tokens[role]}`),
    post: (url: string) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${tokens[role]}`),
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
    return res.body[0] as { id: string };
  }

  /**
   * Audit rows arrive through the outbox relay, after the response, so poll
   * for the one this test caused instead of reading straight away.
   */
  async function waitForAudit(
    action: string,
    match: (metadata: Record<string, unknown>) => boolean,
  ) {
    const deadline = Date.now() + 15_000;
    for (;;) {
      const rows = await prisma.auditLog.findMany({
        where: { action },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      const hit = rows.find((r) =>
        match((r.metadata ?? {}) as Record<string, unknown>),
      );
      if (hit || Date.now() > deadline) return hit ?? null;
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();

    const users = app.get(UsersService);
    for (const role of roles) {
      const email = `gap-${role.toLowerCase()}-${run}@test.local`;
      const u = await users.create({
        email,
        fullName: `Gap ${role}`,
        password,
        // Add-ons only extend their base role, so hold both.
        roles: ADDON_ROLES[role] ? [ADDON_ROLES[role], role] : [role],
      });
      userIds[role] = u.id;
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      tokens[role] = login.body.tokens.accessToken as string;
    }
    // App boot plus eight argon2 sign-ups is slow on small CI runners.
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

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
      for (const role of [ROLES.READ_ADMIN, ROLES.STAFF, ROLES.GATE]) {
        await as(role)
          .post('/consent/withdraw')
          .send({ email: 'x@y.com' })
          .expect(403);
      }
      for (const role of [ROLES.VMC, ROLES.ADMIN, ROLES.VMC_ADMIN]) {
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

  describe('intake + scoped visit reads', () => {
    it('requires both Yes/No answers on every guest', async () => {
      const noEvac: Record<string, unknown> = guest(`a-${run}@x.com`);
      delete noEvac.needsEvacuationAssist;
      await as(ROLES.VMC)
        .post('/visits')
        .send({ type: 'WALK_IN', guests: [noEvac] })
        .expect(400);
      const noConsent: Record<string, unknown> = guest(`b-${run}@x.com`);
      delete noConsent.commsConsent;
      await as(ROLES.VMC)
        .post('/visits')
        .send({ type: 'WALK_IN', guests: [noConsent] })
        .expect(400);
    });

    it('asks what help is needed when the evacuation answer is Yes', async () => {
      // Yes without a type, OTHER without a description, No with a type.
      for (const over of [
        { needsEvacuationAssist: true },
        { needsEvacuationAssist: true, evacuationAssistTypes: ['OTHER'] },
        { needsEvacuationAssist: false, evacuationAssistTypes: ['VISUAL'] },
      ]) {
        await as(ROLES.VMC)
          .post('/visits')
          .send({ type: 'WALK_IN', guests: [guest(`t-${run}@x.com`, over)] })
          .expect(400);
      }
    });

    it('stores the answers and an optional walk-in host', async () => {
      // A STAFF user is a valid host.
      const res = await as(ROLES.VMC)
        .post('/visits')
        .send({
          type: 'WALK_IN',
          guests: [
            guest(`host-${run}@x.com`, {
              hostUserId: userIds[ROLES.STAFF],
              needsEvacuationAssist: true,
              evacuationAssistTypes: ['MOBILITY', 'OTHER'],
              evacuationAssistOther: 'Needs a ramp',
              commsConsent: true,
            }),
          ],
        })
        .expect(201);
      expect(res.body[0]).toMatchObject({
        needsEvacuationAssist: true,
        evacuationAssistTypes: ['MOBILITY', 'OTHER'],
        evacuationAssistOther: 'Needs a ramp',
        commsConsent: true,
        host: { userId: userIds[ROLES.STAFF] },
      });
    });

    it('scopes GET /visits and GET /visits/:id for roles without visit:read', async () => {
      const other = await walkIn(`scoped-${run}@x.com`);
      const staffList = await as(ROLES.STAFF).get('/visits?pageSize=100');
      expect(staffList.status).toBe(200);
      expect(
        (staffList.body.items as { id: string }[]).some(
          (v) => v.id === other.id,
        ),
      ).toBe(false);
      await as(ROLES.STAFF).get(`/visits/${other.id}`).expect(404);
      await as(ROLES.GATE).get(`/visits/${other.id}`).expect(404);

      // Staff still see the visit they host.
      const hosted = await as(ROLES.VMC)
        .post('/visits')
        .send({
          type: 'WALK_IN',
          guests: [
            guest(`hosted-${run}@x.com`, { hostUserId: userIds[ROLES.STAFF] }),
          ],
        })
        .expect(201);
      await as(ROLES.STAFF).get(`/visits/${hosted.body[0].id}`).expect(200);

      // Roles with visit:read keep full access (Read Admin via history:read).
      await as(ROLES.READ_ADMIN).get(`/visits/${other.id}`).expect(200);
      const all = await as(ROLES.VMC).get('/visits?pageSize=100');
      expect(all.body.total as number).toBeGreaterThan(
        staffList.body.total as number,
      );
    });

    it('forces the inbox to "mine" for roles without visit:read', async () => {
      const other = await walkIn(`inbox-${run}@x.com`);
      const ids = (body: { items: { id: string }[] }) =>
        body.items.map((i) => i.id);

      const staff = await as(ROLES.STAFF)
        .get('/inbox?kind=requests&scope=all&pageSize=100')
        .expect(200);
      expect(ids(staff.body)).not.toContain(other.id);

      const vmc = await as(ROLES.VMC)
        .get('/inbox?kind=requests&scope=all&pageSize=100')
        .expect(200);
      expect(ids(vmc.body)).toContain(other.id);
    });
  });

  describe('evacuation roll', () => {
    it('shows checked-in Yes visitors only, and drops them at check-out', async () => {
      const yes = await walkIn(`evac-yes-${run}@x.com`, {
        needsEvacuationAssist: true,
        evacuationAssistTypes: ['HEARING'],
        floor: '5th Floor',
      });
      const no = await walkIn(`evac-no-${run}@x.com`, {
        needsEvacuationAssist: false,
      });
      await prisma.visit.updateMany({
        where: { id: { in: [yes.id, no.id] } },
        data: { status: 'CHECKED_IN', checkInAt: new Date() },
      });
      // A legacy visit (never asked) must not appear either.
      await prisma.visit.update({
        where: { id: (await walkIn(`evac-null-${run}@x.com`)).id },
        data: {
          status: 'CHECKED_IN',
          checkInAt: new Date(),
          needsEvacuationAssist: null,
        },
      });

      const roll = await as(ROLES.GATE)
        .get('/visits/evacuation-roll')
        .expect(200);
      const ids = (roll.body.rows as { visitId: string }[]).map(
        (r) => r.visitId,
      );
      expect(ids).toContain(yes.id);
      expect(ids).not.toContain(no.id);
      expect(
        (roll.body.rows as { visitId: string; assistTypes: string[] }[]).find(
          (r) => r.visitId === yes.id,
        )?.assistTypes,
      ).toEqual(['HEARING']);
      expect(roll.body.count).toBe(ids.length);
      expect(roll.body.checkedInTotal).toBeGreaterThanOrEqual(3);

      await prisma.visit.update({
        where: { id: yes.id },
        data: { status: 'CHECKED_OUT', checkOutAt: new Date() },
      });
      const after = await as(ROLES.GATE).get('/visits/evacuation-roll');
      expect(
        (after.body.rows as { visitId: string }[]).map((r) => r.visitId),
      ).not.toContain(yes.id);
    });
  });

  describe('comms consent', () => {
    const inList = async (email: string) => {
      const res = await as(ROLES.READ_ADMIN)
        .get(`/consent/opt-ins?search=${encodeURIComponent(email)}`)
        .expect(200);
      return (res.body.items as { email: string }[]).some(
        (i) => i.email === email,
      );
    };

    it('uses the latest answer per email (Yes then No → out; No then Yes → in)', async () => {
      const a = `consent-a-${run}@x.com`;
      await walkIn(a, { commsConsent: true });
      expect(await inList(a)).toBe(true);
      await walkIn(a, { commsConsent: false });
      expect(await inList(a)).toBe(false);

      const b = `consent-b-${run}@x.com`;
      await walkIn(b, { commsConsent: false });
      expect(await inList(b)).toBe(false);
      await walkIn(b, { commsConsent: true });
      expect(await inList(b)).toBe(true);
    });

    it("shows a walk-in's own visit reference as the source visit", async () => {
      const d = `consent-d-${run}@x.com`;
      const v = await walkIn(d, { commsConsent: true });
      const visit = await prisma.visit.findUnique({ where: { id: v.id } });
      expect(visit?.referenceCode).toMatch(/\S/);
      const res = await as(ROLES.READ_ADMIN)
        .get(`/consent/opt-ins?search=${encodeURIComponent(d)}`)
        .expect(200);
      expect(res.body.items).toEqual([
        expect.objectContaining({
          email: d,
          sourceVisitId: v.id,
          sourceReferenceCode: visit?.referenceCode,
        }),
      ]);
    });

    it('withdrawal removes the email immediately and leaves visit records unchanged', async () => {
      const c = `consent-c-${run}@x.com`;
      const v = await walkIn(c, { commsConsent: true });
      const before = await as(ROLES.READ_ADMIN)
        .get('/consent/opt-ins')
        .expect(200);
      await as(ROLES.VMC)
        .post('/consent/withdraw')
        .send({ email: `  ${c.toUpperCase()} ` })
        .expect(200)
        .expect({ affected: true });
      expect(await inList(c)).toBe(false);
      const after = await as(ROLES.READ_ADMIN)
        .get('/consent/opt-ins')
        .expect(200);
      expect(after.body.total).toBe(before.body.total - 1);
      const visit = await prisma.visit.findUnique({ where: { id: v.id } });
      expect(visit?.commsConsent).toBe(true);
      const audit = await waitForAudit(
        'consent.withdrawn',
        (m) => m.email === c.toLowerCase(),
      );
      expect(audit).not.toBeNull();
    });

    it('lists withdrawn people under "out" and a System Admin can opt them back in', async () => {
      const e = `consent-e-${run}@x.com`;
      await walkIn(e, { commsConsent: true });
      await as(ROLES.VMC)
        .post('/consent/withdraw')
        .send({ email: e })
        .expect(200);
      const out = await as(ROLES.READ_ADMIN)
        .get(`/consent/opt-ins?status=out&search=${encodeURIComponent(e)}`)
        .expect(200);
      expect(out.body.items).toEqual([
        expect.objectContaining({ email: e, consent: false }),
      ]);
      // The name still shows although the latest event has no visit.
      expect(out.body.items[0].fullName).toEqual(expect.any(String));

      await as(ROLES.SUPER_ADMIN)
        .post('/consent/grant')
        .send({ email: e })
        .expect(200)
        .expect({ affected: true });
      expect(await inList(e)).toBe(true);
      const audit = await waitForAudit('consent.granted', (m) => m.email === e);
      expect(audit).not.toBeNull();
    });

    it('exports a BOM-prefixed CSV for the Security Manager', async () => {
      const res = await as(ROLES.ADMIN).get('/consent/opt-ins.csv').expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(
        'aatc-email-consent_',
      );
      expect(res.text.charCodeAt(0)).toBe(0xfeff);
    });
  });

  describe('delivery status', () => {
    it('lists masked deliveries, hides errors below Security Manager, and retries a failure', async () => {
      const v = await walkIn(`deliv-${run}@x.com`);
      const failed = await prisma.notification.create({
        data: {
          visitId: v.id,
          channel: 'SMS',
          recipient: '+2348031184420',
          templateKey: 'visit.thank_you',
          status: 'FAILED',
          attempts: 5,
          error: 'Number rejected by carrier',
        },
      });
      await prisma.notification.create({
        data: {
          visitId: v.id,
          channel: 'IN_APP',
          templateKey: 'visit.thank_you',
          status: 'SENT',
        },
      });

      const vmc = await as(ROLES.VMC)
        .get(`/visits/${v.id}/notifications`)
        .expect(200);
      expect(vmc.body).toHaveLength(1);
      expect(vmc.body[0]).toMatchObject({
        channel: 'SMS',
        recipientMasked: '+234 ***420',
        status: 'FAILED',
        error: null,
      });
      const sm = await as(ROLES.ADMIN).get(`/visits/${v.id}/notifications`);
      expect(sm.body[0].error).toBe('Number rejected by carrier');
      await as(ROLES.STAFF).get(`/visits/${v.id}/notifications`).expect(403);

      const retryUrl = `/visits/${v.id}/notifications/${failed.id}/retry`;
      await as(ROLES.READ_ADMIN).post(retryUrl).expect(403);
      const retried = await as(ROLES.VMC).post(retryUrl).expect(200);
      expect(retried.body.status).toBe('PENDING');
      await as(ROLES.VMC).post(retryUrl).expect(400);
    });
  });

  describe('visitor export', () => {
    it('filters on the WAT visit date across the 23:00 UTC boundary', async () => {
      const inside = await walkIn(`exp-in-${run}@x.com`);
      const outside = await walkIn(`exp-out-${run}@x.com`);
      await prisma.visit.update({
        where: { id: inside.id },
        // 00:30 WAT on 2001-03-17.
        data: { scheduledAt: new Date('2001-03-16T23:30:00Z') },
      });
      await prisma.visit.update({
        where: { id: outside.id },
        // 00:30 WAT on 2001-03-18.
        data: { scheduledAt: new Date('2001-03-17T23:30:00Z') },
      });
      const res = await as(ROLES.ADMIN)
        .get('/visits/export?from=2001-03-17&to=2001-03-17&format=csv')
        .expect(200);
      expect(res.headers['content-disposition']).toContain(
        'aatc-visitors_2001-03-17_2001-03-17.csv',
      );
      expect(res.text).toContain(`exp-in-${run}@x.com`);
      expect(res.text).not.toContain(`exp-out-${run}@x.com`);
      const audit = await waitForAudit(
        'report.visits_exported',
        (m) => m.from === '2001-03-17' && m.format === 'csv',
      );
      expect(audit?.metadata).toMatchObject({ rowCount: 1 });
      // Recorded before streaming began, under the same export id.
      const started = await waitForAudit(
        'report.visits_export_started',
        (m) => m.from === '2001-03-17' && m.format === 'csv',
      );
      expect(started?.metadata).not.toHaveProperty('rowCount');
      expect(started?.entityId).toBe(audit?.entityId);
    });

    it('streams a valid xlsx', async () => {
      const res = await as(ROLES.ADMIN)
        .get('/visits/export?from=2001-03-17&to=2001-03-17&format=xlsx')
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      // xlsx is a zip: "PK" magic.
      expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
      const audit = await waitForAudit(
        'report.visits_exported',
        (m) => m.from === '2001-03-17' && m.format === 'xlsx',
      );
      expect(audit?.metadata).toMatchObject({ rowCount: 1 });
    });
  });
});
