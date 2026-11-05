import type { Prisma, PrismaClient } from '@prisma/client';
import type { HeldRfidCard } from '@vms/contracts';

/** Each visitor's active RFID card, keyed by visitor id (a visitor holds at most one). */
export async function heldRfidCards(
  db: Prisma.TransactionClient | PrismaClient,
  visitorIds: string[],
  now = new Date(),
): Promise<Map<string, HeldRfidCard>> {
  if (visitorIds.length === 0) return new Map();
  const rows = await db.rfidCardAssignment.findMany({
    where: { visitorId: { in: [...new Set(visitorIds)] }, status: 'ACTIVE' },
    include: { card: true },
  });
  return new Map(
    rows.map((r) => [
      r.visitorId,
      {
        assignmentId: r.id,
        cardNumber: r.card.cardNumber,
        validUntil: r.validUntil,
        overdue: r.validUntil < now,
      },
    ]),
  );
}
