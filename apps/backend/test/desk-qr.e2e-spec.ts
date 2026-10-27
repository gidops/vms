import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ADDON_ROLES, ROLES } from '@vms/contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UsersService } from './../src/modules/identity/users.service';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * The VMC desk QR end to end: who may manage it, and the visitor's public
 * flow (open the form, search hosts, submit, receive the desk code by email,
 * verify) through to today's walk-in, plus replaced/disabled QRs, the
 * honeypot, no overwriting of a known visitor, and rate limiting.
 */
jest.setTimeout(30_000);

describe('Desk QR (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const run = Date.now();
  const password = 'Passw0rd!';
  const tokens: Record<string, string> = {};
  const userIds: Record<string, string> = {};
  const codeEmail = `desk-${run}@test.local`;
  const roles = [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.VMC_ADMIN,
    ROLES.READ_ADMIN,
    ROLES.VMC,
    ROLES.STAFF,
    ROLES.GATE,
  ];

  const http = () => request(app.getHttpServer());
  const as = (role: string) => ({
    get: (url: string) =>
      http().get(url).set('Authorization', `Bearer ${tokens[role]}`),
    post: (url: string) =>
      http().post(url).set('Authorization', `Bearer ${tokens[role]}`),
    patch: (url: string) =>
      http().patch(url).set('Authorization', `Bearer ${tokens[role]}`),
  });

  const tokenOf = (url: string) => url.split('/r/')[1];

  const form = (formToken: string, over: Record<string, unknown> = {}) => ({
    formToken,
    email: `visitor-${run}@x.com`,
    phone: '+2348035521904',
    fullName: 'Ifeoma Chukwu',
    organization: 'Guaranty Trust Bank',
    hostUserId: userIds[ROLES.STAFF],
    floor: '4th Floor',
    purpose: 'Official',
    needsEvacuationAssist: true,
    evacuationAssistTypes: ['MOBILITY'],
    commsConsent: true,
    ...over,
  });

  /** The code is only ever in the email to the desk. */
  async function emailedCode(visitorName: string): Promise<string> {
    const deadline = Date.now() + 5_000;
    for (;;) {
      const row = await prisma.notification.findFirst({
        where: { templateKey: 'desk_qr.code', recipient: codeEmail },
        orderBy: { createdAt: 'desc' },
      });
      const payload = row?.payload as { code?: string; visitorName?: string };
      if (payload?.visitorName === visitorName && payload.code) {
        return payload.code;
      }
      if (Date.now() > deadline) throw new Error('No desk code email');
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async function register(token: string, over: Record<string, unknown>) {
    const open = await http().get(`/public/desk-qr/${token}`).expect(200);
    const sent = await http()
      .post(`/public/desk-qr/${token}/registrations`)
      .send(form(open.body.formToken as string, over))
      .expect(201);
    return sent.body.registrationId as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    // Codes go out by email, so switch email on for this suite (the env is
    // read before the test runs); with no SMTP host it only logs.
    const config = app.get(ConfigService);
    const get = config.get.bind(config) as ConfigService['get'];
    jest
      .spyOn(config, 'get')
      .mockImplementation(((key: string, opts?: unknown) =>
        key === 'EMAIL_ENABLED'
          ? true
          : get(key, opts as never)) as ConfigService['get']);
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.deskQr.deleteMany();

    const users = app.get(UsersService);
    for (const role of roles) {
      const email = `deskqr-${role.toLowerCase()}-${run}@test.local`;
      const u = await users.create({
        email,
        fullName: `Desk ${role} ${run}`,
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

  it('is managed and viewed by the System Admin only', async () => {
    const none = await as(ROLES.SUPER_ADMIN).get('/desk-qr').expect(200);
    expect(none.body === null || none.text === '' || none.text === 'null').toBe(
      true,
    );
    for (const role of roles.filter((r) => r !== ROLES.SUPER_ADMIN)) {
      await as(role).post('/desk-qr').send({ codeEmail }).expect(403);
      await as(role).get('/desk-qr').expect(403);
      await as(role).get('/desk-qr/qr.png').expect(403);
    }
    const created = await as(ROLES.SUPER_ADMIN)
      .post('/desk-qr')
      .send({ codeEmail })
      .expect(201);
    expect(created.body).toMatchObject({ isActive: true, codeEmail });
    expect(tokenOf(created.body.url as string)).toMatch(/^[\w-]{22}$/);
    await as(ROLES.SUPER_ADMIN)
      .post('/desk-qr')
      .send({ codeEmail })
      .expect(409);
    const png = await as(ROLES.SUPER_ADMIN).get('/desk-qr/qr.png').expect(200);
    expect(png.headers['content-type']).toBe('image/png');
  });

  it('registers a visitor once reception reads them the emailed code', async () => {
    const qr = await as(ROLES.SUPER_ADMIN).get('/desk-qr').expect(200);
    const token = tokenOf(qr.body.url as string);

    const hostSearch = (formToken: string) =>
      http().get(
        `/public/desk-qr/${token}/hosts?q=${encodeURIComponent(`STAFF ${run}`)}&formToken=${encodeURIComponent(formToken)}`,
      );
    await hostSearch('not-a-form-token').expect(422);
    const opened = await http().get(`/public/desk-qr/${token}`).expect(200);
    const hosts = await hostSearch(opened.body.formToken as string).expect(200);
    expect(hosts.body).toEqual([
      expect.objectContaining({ userId: userIds[ROLES.STAFF] }),
    ]);
    expect(hosts.body[0]).not.toHaveProperty('email');

    const id = await register(token, {});
    expect(
      await prisma.visit.count({
        where: { visitor: { email: form('').email } },
      }),
    ).toBe(0);
    const code = await emailedCode('Ifeoma Chukwu');

    const wrong = code === '000000' ? '111111' : '000000';
    await http()
      .post(`/public/desk-qr/${token}/registrations/${id}/verify`)
      .send({ code: wrong })
      .expect(422);
    const done = await http()
      .post(`/public/desk-qr/${token}/registrations/${id}/verify`)
      .send({ code })
      .expect(200);
    expect(done.body).toMatchObject({
      fullName: 'Ifeoma Chukwu',
      hostName: `Desk ${ROLES.STAFF} ${run}`,
    });

    const visit = await prisma.visit.findUniqueOrThrow({
      where: { referenceCode: done.body.referenceCode as string },
    });
    expect(visit).toMatchObject({
      type: 'WALK_IN',
      status: 'APPROVED',
      source: 'QR_SELF_REGISTER',
      createdById: null,
      evacuationAssistTypes: ['MOBILITY'],
      commsConsent: true,
    });
    // The code works once.
    await http()
      .post(`/public/desk-qr/${token}/registrations/${id}/verify`)
      .send({ code })
      .expect(404);

    const after = await as(ROLES.SUPER_ADMIN).get('/desk-qr').expect(200);
    expect(after.body.scansToday).toBeGreaterThanOrEqual(1);
  });

  it("never changes a known visitor's saved details", async () => {
    const qr = await as(ROLES.SUPER_ADMIN).get('/desk-qr');
    const token = tokenOf(qr.body.url as string);
    const email = `known-${run}@x.com`;
    await prisma.visitor.create({
      data: { email, fullName: 'Real Name', phone: '+2348000000001' },
    });
    const id = await register(token, {
      email,
      fullName: 'Someone Else',
      phone: '+2348099999999',
    });
    const code = await emailedCode('Someone Else');
    await http()
      .post(`/public/desk-qr/${token}/registrations/${id}/verify`)
      .send({ code })
      .expect(200);
    const visitor = await prisma.visitor.findUniqueOrThrow({
      where: { email },
    });
    expect(visitor).toMatchObject({
      fullName: 'Real Name',
      phone: '+2348000000001',
    });
  });

  it('locks a registration after three wrong codes', async () => {
    const qr = await as(ROLES.SUPER_ADMIN).get('/desk-qr');
    const token = tokenOf(qr.body.url as string);
    const id = await register(token, { fullName: 'Three Strikes' });
    const code = await emailedCode('Three Strikes');
    const wrong = code === '000000' ? '111111' : '000000';
    const verify = (c: string) =>
      http()
        .post(`/public/desk-qr/${token}/registrations/${id}/verify`)
        .send({ code: c });
    await verify(wrong).expect(422);
    await verify(wrong).expect(422);
    await verify(wrong).expect(423);
    await verify(code).expect(423);
  });

  it('drops a filled-in honeypot without sending a code', async () => {
    const qr = await as(ROLES.SUPER_ADMIN).get('/desk-qr');
    const token = tokenOf(qr.body.url as string);
    const open = await http().get(`/public/desk-qr/${token}`).expect(200);
    const before = await prisma.deskQrRegistration.count();
    await http()
      .post(`/public/desk-qr/${token}/registrations`)
      .send(form(open.body.formToken as string, { website: 'spam.example' }))
      .expect(201);
    expect(await prisma.deskQrRegistration.count()).toBe(before);
  });

  it('rejects a forged form and an unanswered help type', async () => {
    const qr = await as(ROLES.SUPER_ADMIN).get('/desk-qr');
    const token = tokenOf(qr.body.url as string);
    const open = await http().get(`/public/desk-qr/${token}`).expect(200);
    await http()
      .post(`/public/desk-qr/${token}/registrations`)
      .send(form('123.forged'))
      .expect(422);
    await http()
      .post(`/public/desk-qr/${token}/registrations`)
      .send(form(open.body.formToken as string, { evacuationAssistTypes: [] }))
      .expect(400);
  });

  it('stops the old poster on New QR, and pauses on Disable', async () => {
    const before = await as(ROLES.SUPER_ADMIN).get('/desk-qr');
    const oldToken = tokenOf(before.body.url as string);
    const rotated = await as(ROLES.SUPER_ADMIN)
      .post('/desk-qr/rotate')
      .expect(200);
    const newToken = tokenOf(rotated.body.url as string);
    expect(newToken).not.toBe(oldToken);
    await http().get(`/public/desk-qr/${oldToken}`).expect(404);
    await http().get(`/public/desk-qr/${newToken}`).expect(200);

    await as(ROLES.SUPER_ADMIN).post('/desk-qr/disable').expect(200);
    await http().get(`/public/desk-qr/${newToken}`).expect(404);
    await as(ROLES.SUPER_ADMIN).post('/desk-qr/enable').expect(200);
    await http().get(`/public/desk-qr/${newToken}`).expect(200);
    // Unknown codes get the same answer as replaced ones.
    await http().get('/public/desk-qr/AAAAAAAAAAAAAAAAAAAAAA').expect(404);

    await as(ROLES.SUPER_ADMIN)
      .patch('/desk-qr')
      .send({ codeEmail: `new-${codeEmail}` })
      .expect(200)
      .expect((res) => expect(res.body.codeEmail).toBe(`new-${codeEmail}`));
    await as(ROLES.SUPER_ADMIN)
      .patch('/desk-qr')
      .send({ codeEmail })
      .expect(200);
  });

  it('audits every change without the printed token', async () => {
    const deadline = Date.now() + 15_000;
    let rows: { action: string; metadata: unknown }[] = [];
    while (Date.now() < deadline) {
      rows = await prisma.auditLog.findMany({
        where: { action: { startsWith: 'desk_qr.' } },
        select: { action: true, metadata: true },
      });
      const actions = new Set(rows.map((r) => r.action));
      if (
        ['desk_qr.created', 'desk_qr.rotated', 'desk_qr.code_sent'].every((a) =>
          actions.has(a),
        )
      )
        break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const qr = await prisma.deskQr.findFirstOrThrow();
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain(qr.token);
  });

  it('rate-limits submissions from one phone', async () => {
    const qr = await as(ROLES.SUPER_ADMIN).get('/desk-qr');
    const token = tokenOf(qr.body.url as string);
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await http()
        .post(`/public/desk-qr/${token}/registrations`)
        .send({});
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });
});
