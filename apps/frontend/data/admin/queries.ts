import { useQuery } from "@tanstack/react-query";
import type { VisitStatus, VisitType } from "@vms/contracts";
import { inboxApi } from "@/data/inbox/inbox.api";
import { visitsApi } from "@/data/visits/visits.api";
import { adminApi } from "./admin.api";
export type { AdminOverviewStats } from "@vms/contracts";

export interface DayWindow {
  dateFrom: string;
  dateTo: string;
}

/** Local-day window, `offset` days from today (−1 = yesterday). */
export function dayWindow(offset = 0, now = new Date()): DayWindow {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

/** Person counts come from individual visits, not collapsed list rows. */
export function useAdminOverviewStats() {
  const today = dayWindow(0);
  const yesterday = dayWindow(-1);
  const params = {
    ...today,
    yesterdayFrom: yesterday.dateFrom,
    yesterdayTo: yesterday.dateTo,
  };
  return useQuery({
    queryKey: ["visits", "admin", "stats", params] as const,
    queryFn: () => adminApi.stats(params),
    refetchInterval: 30_000,
  });
}

/** Includes requests sent back for more info; they return to PENDING when resubmitted. */
const APPROVAL_QUEUE_STATUSES = [
  "PENDING",
  "REVIEW_REQUESTED",
] as const satisfies readonly VisitStatus[];

export function useApprovalQueue({
  enabled = true,
}: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["visits", "admin", "approvalQueue"] as const,
    queryFn: () =>
      visitsApi.list({
        statuses: [...APPROVAL_QUEUE_STATUSES],
        // Oldest raised first, so the first page holds the longest waits.
        sortBy: "createdAt",
        sortDir: "asc",
        pageSize: 100,
      }),
    refetchInterval: 30_000,
    // Roles that can't approve have no use for the queue; skip the polling.
    enabled,
  });
}

export function useTodaysVisitors(
  search: string,
  page = 1,
  pageSize = 5,
  statuses?: VisitStatus[],
) {
  const today = dayWindow(0);
  return useQuery({
    queryKey: [
      "visits",
      "admin",
      "todaysVisitors",
      today.dateFrom,
      search,
      page,
      pageSize,
      statuses?.join(",") ?? "all",
    ],
    queryFn: () =>
      visitsApi.list({
        ...today,
        search: search || undefined,
        statuses,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
  });
}

/** Latest requests + security alerts across the site (no read side effects). */
export function useRecentActivity(pageSize = 6) {
  return useQuery({
    queryKey: ["inbox", "admin", "activity", pageSize] as const,
    refetchInterval: 30_000,
    queryFn: () => inboxApi.list("all", { scope: "all", pageSize }),
  });
}

export interface AdminVisitsParams {
  search?: string;
  status?: VisitStatus;
  statuses?: VisitStatus[];
  type?: VisitType;
  purpose?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Which date column the window filters on (default `scheduledAt`). */
  dateField?: "scheduledAt" | "createdAt";
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function useAdminVisits(params: AdminVisitsParams) {
  return useQuery({
    queryKey: ["visits", "admin", "v2", params] as const,
    queryFn: () => visitsApi.list(params),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
  });
}
