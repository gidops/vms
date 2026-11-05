import type { GateVerdict } from '@vms/contracts';
import type { VisitStatus, VisitType } from '@prisma/client';
import { watDayRange, watToday } from '../../shared/common/wat';

export interface GateVisitFacts {
  type: VisitType;
  status: VisitStatus;
  scheduledAt: Date | null;
}

const AWAITING_APPROVAL: VisitStatus[] = [
  'PENDING',
  'REVIEW_REQUESTED',
  'FLAGGED',
];

/**
 * What the gate tells the visitor. Only pre-arranged visits are gate business:
 * a walk-in code reads as "no invitation". Security holds are not considered,
 * the VMC enforces them at check-in.
 */
export function gateVerdict(
  visit: GateVisitFacts | null,
  now: Date = new Date(),
): GateVerdict {
  if (!visit || visit.type === 'WALK_IN') return 'NOT_FOUND';
  if (visit.status === 'CHECKED_IN') return 'ALREADY_CHECKED_IN';
  if (AWAITING_APPROVAL.includes(visit.status)) return 'NOT_CONFIRMED';
  if (visit.status !== 'APPROVED') return 'CLOSED';

  const today = watDayRange(watToday(now), watToday(now));
  const isToday =
    !!visit.scheduledAt &&
    visit.scheduledAt >= today.gte &&
    visit.scheduledAt < today.lt;
  return isToday ? 'VALID_TODAY' : 'WRONG_DAY';
}
