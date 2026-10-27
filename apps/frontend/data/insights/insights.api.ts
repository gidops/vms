import type {
  AdminOverviewStats,
  InsightsAnalytics,
  InsightsRange,
  InsightsVisitorDetail,
  InsightsVisitorItem,
} from "@vms/contracts";
import { api } from "@/data/http/client";
import type { Paginated, VisitListItem } from "@/data/visits/visits.api";

/** A contract type as it arrives over JSON: dates are ISO strings. */
export type Wire<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;

export type VisitorItem = Wire<InsightsVisitorItem>;
export type VisitorDetail = Wire<InsightsVisitorDetail>;

export interface InsightsHistoryParams {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface InsightsVisitorsParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

function query(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  return q ? `?${q}` : "";
}

/** The server picks the scope from the caller's permissions, so these never send one. */
export const insightsApi = {
  overview() {
    return api<AdminOverviewStats>(`/insights/overview`);
  },
  history(params: InsightsHistoryParams = {}) {
    return api<Paginated<VisitListItem>>(
      `/insights/history${query({ sortBy: "scheduledAt", sortDir: "desc", ...params })}`,
    );
  },
  visitors(params: InsightsVisitorsParams = {}) {
    return api<Paginated<VisitorItem>>(`/insights/visitors${query(params)}`);
  },
  visitor(id: string) {
    return api<VisitorDetail>(`/insights/visitors/${id}`);
  },
  analytics(range: InsightsRange) {
    return api<InsightsAnalytics>(`/insights/analytics${query({ range })}`);
  },
};
