import type { VisitListItem } from "@/data/visits/visits.api";

/** A request waiting longer than this is "overdue" (red chip, band hint). */
export const OVERDUE_MINUTES = 60;

export function waitingMinutes(createdAt: string, now: Date): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60_000),
  );
}

/** Requests sent back for more information wait on the host, so they never count as overdue. */
export function countOverdue(
  items: readonly Pick<VisitListItem, "createdAt" | "status">[],
  now: Date,
): number {
  return items.filter(
    (v) =>
      v.status === "PENDING" &&
      waitingMinutes(v.createdAt, now) >= OVERDUE_MINUTES,
  ).length;
}
