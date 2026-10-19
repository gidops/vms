import type { VisitListItem } from "@/data/visits/visits.api";

/** How many requests the overview shows before "See all". */
export const PENDING_PREVIEW = 4;

/** A request waiting longer than this is "overdue" (red chip, bar hint). */
export const OVERDUE_MINUTES = 60;

/** Oldest request first (by when it was raised), without mutating the input. */
export function sortOldestFirst<T extends Pick<VisitListItem, "createdAt">>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Whole minutes a request has been waiting at `now` (never negative). */
export function waitingMinutes(createdAt: string, now: Date): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60_000),
  );
}

/** Number of requests waiting longer than {@link OVERDUE_MINUTES}. */
export function countOverdue(
  items: readonly Pick<VisitListItem, "createdAt">[],
  now: Date,
): number {
  return items.filter(
    (v) => waitingMinutes(v.createdAt, now) >= OVERDUE_MINUTES,
  ).length;
}
