import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ADDON_ROLES, ROLES } from '@vms/contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UsersService } from './../src/modules/identity/users.service';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Operations (System Admin only) end to end: every other role is refused on
 * the RFID access-card and audit-trail endpoints; a card goes out, is printed,
 * comes back and can be reissued; every step lands in the audit trail, whose
 * CSV export is itself audited.
 */
jest.setTimeout(30_000);

describe('Operations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const run = Date.now();
  const password = 'Passw0rd!';
  const tokens: Record<string, string> = {};
  const roles = [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.VMC_ADMIN,
    ROLES.READ_ADMIN,
    ROLES.VMC,
    ROLES.STAFF,
  ];
  const cardNumber = `RF-${run}`;
  const today = new Date().toISOString().slice(0, 10);

  const http = () => request(app.getHttpServer());
  const as = (role: string) => ({
    get: (url: string) =>
      http().get(url).set('Authorization', `Bearer ${tokens[role]}`),
    post: (url: string) =>
      http().post(url).set('Authorization', `Bearer ${tokens[role]}`),
    patch: (url: string) =>
      http().patch(url).set('Authorization', `Bearer ${tokens[role]}`),
  });
  const sa = () => as(ROLES.SUPER_ADMIN);

  async function walkIn(email: string) {
    const res = await sa()
      .post('/visits')
      .send({
        type: 'WALK_IN',
        guests: [
          {
            fullName: `Guest ${email}`,
            email,
            organization: 'Org',
            floor: '4th Floor',
            purpose: 'Official',
            needsEvacuationAssist: false,
            commsConsent: false,
          },
        ],
      })
      .expect(201);
    return res.body[0] as { id: string; visitor: { id: string } };
  }

  /** Audit rows arrive through the outbox relay, so poll for them. */
  async function waitForAudit(action: string, entityId: string) {
    const deadline = Date.now() + 15_000;
    for (;;) {
      const row = await prisma.auditLog.findFirst({
        where: { action, entityId },
      });
      if (row || Date.now() > deadline) return row;
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
      const email = `ops-${role.toLowerCase()}-${run}@test.local`;
      await users.create({
        email,
        fullName: `Ops ${role} ${run}`,
        password,
        // Add-ons only extend their base role, so hold both.
        roles: ADDON_ROLES[role] ? [ADDON_ROLES[role], role] : [role],
      });
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

  it('refuses every role but the System Admin', async () => {
    const urls = [
      '/rfid-cards',
      '/rfid-cards/assignments',
      `/audit?from=${today}&to=${today}`,
      `/audit/export.csv?from=${today}&to=${today}`,
    ];
    for (const role of roles.filter((r) => r !== ROLES.SUPER_ADMIN)) {
      for (const url of urls) {
        await as(role).get(url).expect(403);
      }
      await as(role)
        .post('/rfid-cards/photos/presign')
        .send({ contentType: 'image/jpeg' })
        .expect(403);
    }
    for (const url of urls.slice(0, 3)) await sa().get(url).expect(200);
  });

  it('issues, prints, returns and reissues a card, all audited', async () => {
    const first = await walkIn(`ops-a-${run}@x.com`);
    const second = await walkIn(`ops-b-${run}@x.com`);
    const window = {
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 8 * 3_600_000).toISOString(),
    };

    const issued = await sa()
      .post('/rfid-cards/assignments')
      .send({
        cardNumber: cardNumber.toLowerCase(),
        visitorId: first.visitor.id,
        visitId: first.id,
        ...window,
      })
      .expect(201);
    expect(issued.body).toMatchObject({
      status: 'ACTIVE',
      card: { cardNumber }, // stored upper-cased
      visit: { id: first.id },
      overdue: false,
    });
    const id = issued.body.id as string;

    // The card is out, and the visitor already holds one.
    await sa()
      .post('/rfid-cards/assignments')
      .send({ cardNumber, visitorId: second.visitor.id, ...window })
      .expect(409);
    await sa()
      .post('/rfid-cards/assignments')
      .send({
        cardNumber: `${cardNumber}-X`,
        visitorId: first.visitor.id,
        ...window,
      })
      .expect(409);
    // A visit of someone else is refused.
    await sa()
      .post('/rfid-cards/assignments')
      .send({
        cardNumber: `${cardNumber}-Y`,
        visitorId: second.visitor.id,
        visitId: first.id,
        ...window,
      })
      .expect(400);

    await sa().post(`/rfid-cards/assignments/${id}/printed`).expect(200);
    const reprint = await sa()
      .post(`/rfid-cards/assignments/${id}/printed`)
      .expect(200);
    expect(reprint.body.printCount).toBe(2);

    const extended = await sa()
      .patch(`/rfid-cards/assignments/${id}`)
      .send({ validUntil: new Date(Date.now() + 48 * 3_600_000).toISOString() })
      .expect(200);
    expect(
      new Date(extended.body.validUntil as string).getTime(),
    ).toBeGreaterThan(Date.now() + 24 * 3_600_000);

    const active = await sa()
      .get(`/rfid-cards/assignments?search=${cardNumber}`)
      .expect(200);
    expect(active.body.items.map((i: { id: string }) => i.id)).toContain(id);

    await sa()
      .post(`/rfid-cards/assignments/${id}/close`)
      .send({ outcome: 'RETURNED' })
      .expect(200);
    await sa()
      .post(`/rfid-cards/assignments/${id}/close`)
      .send({ outcome: 'RETURNED' })
      .expect(409);

    // Back in the pool: the same card goes to the second visitor.
    const again = await sa()
      .post('/rfid-cards/assignments')
      .send({ cardNumber, visitorId: second.visitor.id, ...window })
      .expect(201);
    const registry = await sa()
      .get(`/rfid-cards?search=${cardNumber}`)
      .expect(200);
    expect(registry.body.items[0]).toMatchObject({
      cardNumber,
      status: 'ASSIGNED',
      timesIssued: 2,
      current: { assignmentId: again.body.id },
    });

    // Lost, then found again.
    await sa()
      .post(`/rfid-cards/assignments/${again.body.id}/close`)
      .send({ outcome: 'LOST', note: 'Not returned' })
      .expect(200);
    const cardId = registry.body.items[0].id as string;
    await sa()
      .post('/rfid-cards/assignments')
      .send({ cardNumber, visitorId: first.visitor.id, ...window })
      .expect(409);
    await sa()
      .post(`/rfid-cards/${cardId}/status`)
      .send({ status: 'AVAILABLE' })
      .expect(204);

    for (const action of [
      'rfid_card.assigned',
      'rfid_card.printed',
      'rfid_card.updated',
      'rfid_card.returned',
    ]) {
      expect(await waitForAudit(action, id)).not.toBeNull();
    }
    expect(await waitForAudit('rfid_card.lost', again.body.id)).not.toBeNull();
    expect(
      await waitForAudit('rfid_card.status_changed', cardId),
    ).not.toBeNull();

    const trail = await sa()
      .get(`/audit?from=${today}&to=${today}&category=rfid_card&search=${id}`)
      .expect(200);
    expect(
      (trail.body.items as { action: string }[]).map((i) => i.action),
    ).toEqual(
      expect.arrayContaining(['rfid_card.assigned', 'rfid_card.returned']),
    );
  });

  it('exports the audit trail as CSV and audits the export', async () => {
    const res = await sa()
      .get(`/audit/export.csv?from=${today}&to=${today}&category=rfid_card`)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\r\n')[0]).toContain('Time (WAT)');
    expect(res.text).toContain('rfid_card.');
    // Audited through the outbox relay, so poll for the row.
    const since = new Date(Date.now() - 60_000);
    let exported: Awaited<ReturnType<typeof prisma.auditLog.findFirst>> = null;
    for (
      const deadline = Date.now() + 15_000;
      !exported && Date.now() < deadline;
    ) {
      exported = await prisma.auditLog.findFirst({
        where: { action: 'audit.exported', createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
      });
      if (!exported) await new Promise((r) => setTimeout(r, 250));
    }
    expect(exported?.metadata).toMatchObject({ category: 'rfid_card' });
    expect(
      (exported?.metadata as { rowCount: number }).rowCount,
    ).toBeGreaterThan(0);
  });

  it('rejects a range longer than 366 days', async () => {
    await sa().get('/audit?from=2024-01-01&to=2026-01-01').expect(400);
  });
});
