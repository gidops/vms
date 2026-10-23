import type { VisitListItem } from "@/data/visits/visits.api";

/** How many requests the overview shows before "See all". */
export const PENDING_PREVIEW = 4;

/** A request waiting longer than this is "overdue" (red chip, bar hint). */
export const OVERDUE_MINUTES = 60;

/** The pending approvals card's segments, in display order. */
export const APPROVAL_FILTERS = ["all", "walkIn", "invite", "group"] as const;
export type ApprovalFilter = (typeof APPROVAL_FILTERS)[number];

/** Whether a queue row belongs in a segment (a group is never a walk-in/invite row). */
export function matchesApprovalFilter(
  v: Pick<VisitListItem, "type" | "isGroupVisit">,
  filter: ApprovalFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "group":
      return v.isGroupVisit;
    case "walkIn":
      return !v.isGroupVisit && v.type === "WALK_IN";
    case "invite":
      return !v.isGroupVisit && v.type !== "WALK_IN";
  }
}

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

/**
 * Number of requests awaiting a decision for longer than
 * {@link OVERDUE_MINUTES}. Requests sent back for more information are waiting
 * on the host, not the approver, so they never count.
 */
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
