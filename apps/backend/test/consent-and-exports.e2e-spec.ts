import { ROLES } from '@vms/contracts';
import { maskEmail } from '../src/shared/common/mask';
import { useRoleApp } from './support/role-app';

/** Comms consent, notification delivery status and retry, and the WAT-bounded visitor export. */
jest.setTimeout(30_000);

describe('Consent, deliveries and exports (e2e)', () => {
  const ctx = useRoleApp('consent');
  const { as, walkIn, waitForAudit, run } = ctx;

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
      const visit = await ctx.prisma.visit.findUnique({ where: { id: v.id } });
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
      const visit = await ctx.prisma.visit.findUnique({ where: { id: v.id } });
      expect(visit?.commsConsent).toBe(true);
      const audit = await waitForAudit(
        'consent.withdrawn',
        (m) => m.email === maskEmail(c.toLowerCase()),
      );
      expect(audit).not.toBeNull();
      expect(JSON.stringify(audit?.metadata)).not.toContain(c.toLowerCase());
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
      const audit = await waitForAudit(
        'consent.granted',
        (m) => m.email === maskEmail(e),
      );
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
      const failed = await ctx.prisma.notification.create({
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
      await ctx.prisma.notification.create({
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
      await ctx.prisma.visit.update({
        where: { id: inside.id },
        // 00:30 WAT on 2001-03-17.
        data: { scheduledAt: new Date('2001-03-16T23:30:00Z') },
      });
      await ctx.prisma.visit.update({
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
