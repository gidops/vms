import { ROLES } from '@vms/contracts';
import { useRoleApp } from './support/role-app';

/** Intake answers, scoped visit reads and the Evacuation Roll against a real database. */
jest.setTimeout(30_000);

describe('Visit intake and evacuation (e2e)', () => {
  const ctx = useRoleApp('intake');
  const { as, guest, walkIn, userIds, run } = ctx;

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
      await ctx.prisma.visit.updateMany({
        where: { id: { in: [yes.id, no.id] } },
        data: { status: 'CHECKED_IN', checkInAt: new Date() },
      });
      // A legacy visit (never asked) must not appear either.
      await ctx.prisma.visit.update({
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

      await ctx.prisma.visit.update({
        where: { id: yes.id },
        data: { status: 'CHECKED_OUT', checkOutAt: new Date() },
      });
      const after = await as(ROLES.GATE).get('/visits/evacuation-roll');
      expect(
        (after.body.rows as { visitId: string }[]).map((r) => r.visitId),
      ).not.toContain(yes.id);
    });
  });
});
