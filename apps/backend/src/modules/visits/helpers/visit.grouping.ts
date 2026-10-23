import { Prisma } from '@prisma/client';
import type { VisitListItem, VisitListQuery } from '@vms/contracts';

/** Statuses that remove a guest from the visiting group (ignored when deriving a
 *  group's collapsed status and guest count). */
export const GROUP_INACTIVE_STATUSES = new Set<string>([
  'DENIED',
  'CANCELLED',
  'EXPIRED',
]);
/** Lifecycle statuses that mean a guest has not (yet) checked in. */
export const GROUP_PRE_CHECKIN_STATUSES = new Set<string>([
  'PENDING',
  'REVIEW_REQUESTED',
  'APPROVED',
]);

/**
 * The list ordering. Defaults to scheduled date, earliest first (the VMC
 * check-in board surfaces who we're expecting soonest; undated visits sort
 * last). Callers may opt into `sortBy: "createdAt"` — the staff dashboard and
 * VMC records board order newest-created first. Whitelisted so no arbitrary
 * column leaks into Prisma's `orderBy`.
 */
export function buildOrderBy(
  query: VisitListQuery,
): Prisma.VisitOrderByWithRelationInput {
  if (query.sortBy === 'createdAt') return { createdAt: query.sortDir };
  return { scheduledAt: { sort: 'asc', nulls: 'last' } };
}

/**
 * The status shown on a group's single representative row — the most "active"
 * state present among its members (e.g. any checked-in guest marks the group
 * on-site). Falls back to the representative visit's own status.
 */
export function deriveGroupStatus(
  statuses: Set<string> | undefined,
  fallback: VisitListItem['status'],
): VisitListItem['status'] {
  if (!statuses?.size) return fallback;
  // Only active guests count; a denied/cancelled/expired guest left the group.
  const active = [...statuses].filter((s) => !GROUP_INACTIVE_STATUSES.has(s));
  if (active.length === 0) return fallback;
  // Expected while ≥1 active guest still hasn't checked in.
  if (active.some((s) => GROUP_PRE_CHECKIN_STATUSES.has(s))) return 'APPROVED';
  // Everyone has checked in — Checked Out only once all have also left,
  // otherwise Onsite (a checked-out guest still counts as having checked in).
  if (active.every((s) => s === 'CHECKED_OUT')) return 'CHECKED_OUT';
  return 'CHECKED_IN';
}

/** Terminal states a flag / request-info action cannot apply to. */
export function isTerminal(status: string): boolean {
  return (
    status === 'DENIED' ||
    status === 'CANCELLED' ||
    status === 'EXPIRED' ||
    status === 'CHECKED_OUT'
  );
}
