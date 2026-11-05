import { Prisma } from '@prisma/client';
import type { VisitListItem, VisitListQuery } from '@vms/contracts';

/** Statuses that remove a guest from the group's derived status and count. */
export const GROUP_INACTIVE_STATUSES = new Set<string>([
  'DENIED',
  'CANCELLED',
  'EXPIRED',
]);
const GROUP_PRE_CHECKIN_STATUSES = new Set<string>([
  'PENDING',
  'REVIEW_REQUESTED',
  'APPROVED',
]);

/** Whitelisted so no arbitrary column leaks into Prisma's `orderBy`; undated visits sort last. */
export function buildOrderBy(
  query: VisitListQuery,
): Prisma.VisitOrderByWithRelationInput {
  if (query.sortBy === 'createdAt') return { createdAt: query.sortDir };
  if (query.sortBy === 'scheduledAt') {
    return { scheduledAt: { sort: query.sortDir, nulls: 'last' } };
  }
  return { scheduledAt: { sort: 'asc', nulls: 'last' } };
}

/** The most "active" member state, e.g. any checked-in guest marks the group on-site. */
export function deriveGroupStatus(
  statuses: Set<string> | undefined,
  fallback: VisitListItem['status'],
): VisitListItem['status'] {
  if (!statuses?.size) return fallback;
  const active = [...statuses].filter((s) => !GROUP_INACTIVE_STATUSES.has(s));
  if (active.length === 0) return fallback;
  if (active.some((s) => GROUP_PRE_CHECKIN_STATUSES.has(s))) return 'APPROVED';
  // A checked-out guest still counts as checked in, so Onsite until everyone has left.
  if (active.every((s) => s === 'CHECKED_OUT')) return 'CHECKED_OUT';
  return 'CHECKED_IN';
}

export function isTerminal(status: string): boolean {
  return (
    status === 'DENIED' ||
    status === 'CANCELLED' ||
    status === 'EXPIRED' ||
    status === 'CHECKED_OUT'
  );
}
