import { Injectable } from '@nestjs/common';
import {
  FLOORS,
  type EvacuationAssistType,
  type EvacuationRoll,
} from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { identityAtVisit } from './helpers/visit-identity';

/** Higher floors first (building order in `FLOORS`); unknown or empty floors last. */
export function floorRank(floor: string | null | undefined): number {
  if (!floor) return -1;
  return (FLOORS as readonly string[]).indexOf(floor);
}

/** Only visitors who answered "Yes"; a "No" or legacy null never appears. */
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
        ...identityAtVisit(v),
        phone: v.visitor.phone,
        floor: v.floor,
        hostName: v.host?.user.fullName ?? null,
        assistTypes: v.evacuationAssistTypes as EvacuationAssistType[],
        assistOther: v.evacuationAssistOther,
        checkInAt: v.checkInAt,
        badge: v.pass?.accessCard
          ? {
              cardNumber: v.pass.accessCard.cardNumber,
              zone: v.pass.accessCard.zone,
            }
          : null,
      }))
      // Unknown floors share a rank, so tie-break on the name to keep them grouped.
      .sort(
        (a, b) =>
          floorRank(b.floor) - floorRank(a.floor) ||
          (a.floor ?? '').localeCompare(b.floor ?? ''),
      );

    return { generatedAt: now, count: rows.length, checkedInTotal, rows };
  }
}
