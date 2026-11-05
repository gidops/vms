import { ROLES } from '@vms/contracts';
import request from 'supertest';
import { useRoleApp } from './support/role-app';

/**
 * The no-login gate kiosk end to end: only the System Admin manages the kiosk
 * link; the device checks codes with nothing but that link's token, and a
 * rotated or disabled link stops working.
 */
jest.setTimeout(30_000);

describe('Gate kiosk (e2e)', () => {
  const ctx = useRoleApp('gate');
  const { as, walkIn, run } = ctx;
  const device = () => request(ctx.app.getHttpServer());
  const tokenOf = (url: string) => url.split('/gate/')[1];

  /** The kiosk link is a singleton shared across runs: reuse and re-enable it. */
  async function liveToken(): Promise<string> {
    const created = await as(ROLES.SUPER_ADMIN).post('/gate-kiosk');
    if (created.status === 201) return tokenOf(created.body.url as string);
    expect(created.status).toBe(409);
    const enabled = await as(ROLES.SUPER_ADMIN)
      .post('/gate-kiosk/enable')
      .expect(200);
    return tokenOf(enabled.body.url as string);
  }

  /** A pre-invited, approved visit scheduled now, with its invitation code. */
  async function invitedToday(): Promise<{ id: string; code: string }> {
    const { id } = await walkIn(`gate-guest-${run}-${Math.random()}@x.com`);
    const visit = await ctx.prisma.visit.update({
      where: { id },
      data: {
        type: 'PRE_INVITED',
        status: 'APPROVED',
        scheduledAt: new Date(),
        gateValidatedAt: null,
      },
    });
    return { id, code: visit.referenceCode! };
  }

  it('lets only the System Admin manage the kiosk link', async () => {
    for (const role of [
      ROLES.ADMIN,
      ROLES.VMC,
      ROLES.VMC_ADMIN,
      ROLES.STAFF,
      ROLES.READ_ADMIN,
    ]) {
      await as(role).get('/gate-kiosk').expect(403);
      await as(role).post('/gate-kiosk/rotate').expect(403);
    }
  });

  it('checks a code with only the kiosk token and marks the visit gate-verified', async () => {
    const token = await liveToken();
    await device().get(`/public/gate/${token}`).expect(200, { active: true });

    const { id, code } = await invitedToday();
    const res = await device()
      .post(`/public/gate/${token}/verify`)
      .send({ code: code.toLowerCase().replace('-', ' '), source: 'manual' })
      .expect(200);
    expect(res.body.verdict).toBe('VALID_TODAY');
    expect(res.body.visit.visitorName).toContain('Guest');

    const visit = await ctx.prisma.visit.findUniqueOrThrow({ where: { id } });
    expect(visit.gateValidatedAt).not.toBeNull();
    const event = await ctx.prisma.gateEvent.findFirst({
      where: { visitId: id },
      orderBy: { occurredAt: 'desc' },
    });
    expect(event).toMatchObject({
      type: 'INVITATION_VERIFY',
      result: 'VALID_TODAY',
      operativeUserId: null,
    });

    await device()
      .post(`/public/gate/${token}/verify`)
      .send({ code: 'ZZZZ-999', source: 'scan' })
      .expect(200, { verdict: 'NOT_FOUND', visit: null });
  });

  it('refuses unknown, rotated and disabled links alike', async () => {
    await device().get('/public/gate/not_a_real_kiosk_token').expect(404);
    await device().get('/public/gate/bad!').expect(404);

    const old = await liveToken();
    const rotated = await as(ROLES.SUPER_ADMIN)
      .post('/gate-kiosk/rotate')
      .expect(200);
    const fresh = tokenOf(rotated.body.url as string);
    expect(fresh).not.toBe(old);
    await device()
      .post(`/public/gate/${old}/verify`)
      .send({ code: 'ZZZZ-999', source: 'scan' })
      .expect(404);
    await device().get(`/public/gate/${fresh}`).expect(200);

    await as(ROLES.SUPER_ADMIN).post('/gate-kiosk/disable').expect(200);
    await device().get(`/public/gate/${fresh}`).expect(404);
    await as(ROLES.SUPER_ADMIN).post('/gate-kiosk/enable').expect(200);
    await device().get(`/public/gate/${fresh}`).expect(200);
  });
});
