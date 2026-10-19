import { Injectable } from '@nestjs/common';
import { FLOORS, type EvacuationRoll } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Rank a floor for the top-down roll: higher floors first, unknown or empty
 * floors last. Known floors follow the building order in `FLOORS`.
 */
export function floorRank(floor: string | null | undefined): number {
  if (!floor) return -1;
  return (FLOORS as readonly string[]).indexOf(floor);
}

/**
 * Live Evacuation Roll: every CHECKED_IN visit whose visitor answered "Yes" to
 * needing evacuation assistance at intake. A "No" or a legacy null never
 * appears. Ordered by floor (top first), then check-in time.
 */
@Injectable()
export class VisitEvacuationService {
  constructor(private readonly prisma: PrismaService) {}

  async roll(now: Date = new Date()): Promise<EvacuationRoll> {
    const [visits, checkedInTotal] = await Promise.all([
      this.prisma.visit.findMany({
        where: { status: 'CHECKED_IN', needsEvacuationAssist: true },
        include: {
          visitor: true,
          host: { include: { user: true } },
          pass: { include: { accessCard: true } },
        },
        orderBy: { checkInAt: 'asc' },
      }),
      this.prisma.visit.count({ where: { status: 'CHECKED_IN' } }),
    ]);

    const rows = visits
      .map((v) => ({
        visitId: v.id,
        fullName: v.visitor.fullName,
        organization: v.visitor.organization,
        phone: v.visitor.phone,
        floor: v.floor,
        hostName: v.host?.user.fullName ?? null,
        checkInAt: v.checkInAt,
        badge: v.pass?.accessCard
          ? {
              cardNumber: v.pass.accessCard.cardNumber,
              zone: v.pass.accessCard.zone,
            }
          : null,
      }))
      // Stable sort keeps check-in order within a floor; floors outside the
      // known list share a rank, so tie-break on the name to keep them grouped.
      .sort(
        (a, b) =>
          floorRank(b.floor) - floorRank(a.floor) ||
          (a.floor ?? '').localeCompare(b.floor ?? ''),
      );

    return { generatedAt: now, count: rows.length, checkedInTotal, rows };
  }
}
