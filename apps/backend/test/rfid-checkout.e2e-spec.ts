import { ROLES } from '@vms/contracts';
import { useRoleApp } from './support/role-app';

/** Reception takes personalised RFID cards back at check-out (#96). */
jest.setTimeout(30_000);

describe('RFID cards at check-out (e2e)', () => {
  const ctx = useRoleApp('rfid');
  const { as, walkIn, waitForAudit, run } = ctx;
  let seq = 0;

  /** A walk-in whose visitor holds an RFID card valid for the given window. */
  async function visitorWithCard(hours = { from: -1, until: 8 }) {
    const visit = await walkIn(`rfid-${run}-${++seq}@x.com`);
    const detail = await as(ROLES.VMC).get(`/visits/${visit.id}`).expect(200);
    const cardNumber = `RF${run}${seq}`;
    const issued = await as(ROLES.SUPER_ADMIN)
      .post('/rfid-cards/assignments')
      .send({
        cardNumber,
        visitorId: detail.body.visitorId as string,
        visitId: visit.id,
        validFrom: new Date(Date.now() + hours.from * 3_600_000).toISOString(),
        validUntil: new Date(
          Date.now() + hours.until * 3_600_000,
        ).toISOString(),
      })
      .expect(201);
    return {
      visitId: visit.id,
      cardNumber,
      assignmentId: issued.body.id as string,
    };
  }

  it('shows the held card to reception on the visit and the board', async () => {
    const { visitId, cardNumber } = await visitorWithCard();
    const detail = await as(ROLES.VMC).get(`/visits/${visitId}`).expect(200);
    expect(detail.body.rfidCard).toMatchObject({ cardNumber, overdue: false });
    const board = await as(ROLES.VMC)
      .get(`/visits?search=${encodeURIComponent(`rfid-${run}`)}&pageSize=50`)
      .expect(200);
    const row = (
      board.body.items as { id: string; rfidCard?: { cardNumber: string } }[]
    ).find((i) => i.id === visitId);
    expect(row?.rfidCard?.cardNumber).toBe(cardNumber);
  });

  it('will not check the visitor out until the card outcome is recorded', async () => {
    const { visitId, assignmentId } = await visitorWithCard();
    await as(ROLES.VMC)
      .post(`/visits/${visitId}/check-out`)
      .send({})
      .expect(422);
    // Only reception takes cards back.
    await as(ROLES.STAFF)
      .post(`/visits/${visitId}/check-out`)
      .send({ rfidCard: { outcome: 'RETURNED' } })
      .expect(403);
    // "Not returned" needs a note.
    await as(ROLES.VMC)
      .post(`/visits/${visitId}/check-out`)
      .send({ rfidCard: { outcome: 'LOST' } })
      .expect(400);
    const card = await ctx.prisma.rfidCardAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
    });
    expect(card.status).toBe('ACTIVE');
  });

  it('frees a retrieved card and audits it, without giving VMC card management', async () => {
    const { visitId, assignmentId } = await visitorWithCard();
    const res = await as(ROLES.VMC)
      .post(`/visits/${visitId}/check-out`)
      .send({ rfidCard: { outcome: 'RETURNED' } })
      .expect(201);
    expect(res.body).toMatchObject({ status: 'CHECKED_OUT', rfidCard: null });
    const assignment = await ctx.prisma.rfidCardAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { card: true },
    });
    expect(assignment.status).toBe('RETURNED');
    expect(assignment.card.status).toBe('AVAILABLE');
    expect(
      await waitForAudit(
        'rfid_card.returned',
        (m) => m.cardId === assignment.cardId,
      ),
    ).not.toBeNull();
    await as(ROLES.VMC).get('/rfid-cards').expect(403);
  });

  it('marks an unreturned card lost with the desk note', async () => {
    const { visitId, assignmentId } = await visitorWithCard();
    await as(ROLES.VMC)
      .post(`/visits/${visitId}/check-out`)
      .send({ rfidCard: { outcome: 'LOST', note: 'Visitor left with it' } })
      .expect(201);
    const assignment = await ctx.prisma.rfidCardAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { card: true },
    });
    expect(assignment).toMatchObject({
      status: 'LOST',
      closeNote: 'Visitor left with it',
    });
    expect(assignment.card.status).toBe('LOST');
  });

  it('lists cards still out after their valid-until date in Requests & Alerts', async () => {
    const { cardNumber } = await visitorWithCard({ from: -3, until: -1 });
    const inbox = await as(ROLES.VMC)
      .get(`/inbox?kind=cards&search=${cardNumber}`)
      .expect(200);
    expect(inbox.body.items).toEqual([
      expect.objectContaining({ kind: 'card', cardNumber }),
    ]);
    // Staff never see reception's card chase list.
    const staff = await as(ROLES.STAFF).get('/inbox?kind=cards').expect(200);
    expect(staff.body.items).toEqual([]);
  });
});
