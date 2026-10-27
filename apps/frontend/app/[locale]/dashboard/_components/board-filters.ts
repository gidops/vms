import type { VisitStatus, VisitType } from "@vms/contracts";

/** The VMC board only surfaces visits that a Security Manager has cleared for reception. */
export const BOARD_STATUSES = [
  "APPROVED",
  "CHECKED_IN",
  "CHECKED_OUT",
] as const satisfies readonly VisitStatus[];
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const BOARD_TYPES = [
  "WALK_IN",
  "PRE_INVITED",
] as const satisfies readonly VisitType[];
export type BoardType = (typeof BOARD_TYPES)[number];

/** "all" means no filter on that facet. */
export interface BoardFilters {
  /** The applied search (set by Search / Enter, not on every keystroke). */
  search: string;
  status: BoardStatus | "all";
  type: BoardType | "all";
  purpose: string;
}

export const NO_BOARD_FILTERS: BoardFilters = {
  search: "",
  status: "all",
  type: "all",
  purpose: "all",
};

export function boardListParams(f: BoardFilters): {
  statuses: VisitStatus[];
  type?: VisitType;
  purpose?: string;
  search?: string;
} {
  const search = f.search.trim();
  return {
    // A status filter narrows within the board's statuses; "all" keeps all three.
    statuses: f.status === "all" ? [...BOARD_STATUSES] : [f.status],
    ...(f.type === "all" ? {} : { type: f.type }),
    ...(f.purpose === "all" ? {} : { purpose: f.purpose }),
    ...(search ? { search } : {}),
  };
}
