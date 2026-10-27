import { useQuery } from "@tanstack/react-query";
import type { StaffActivityCategory } from "./staff.api";
import { staffApi } from "./staff.api";

export interface ActivityFeedParams {
  date?: string;
  search?: string;
  category?: StaffActivityCategory;
  page?: number;
  pageSize?: number;
}

const keys = {
  stats: ["staff", "stats"] as const,
  activity: (p: ActivityFeedParams = {}) =>
    [
      "staff",
      "activity",
      p.date ?? "all",
      p.category ?? "all",
      p.search ?? "",
      p.page ?? 1,
      p.pageSize ?? 8,
    ] as const,
};

export function useStaffStats() {
  return useQuery({
    queryKey: keys.stats,
    queryFn: () => staffApi.stats(),
  });
}

export function useStaffActivityFeed(params: ActivityFeedParams = {}) {
  return useQuery({
    queryKey: keys.activity(params),
    queryFn: () =>
      staffApi.activityFeed({
        date: params.date,
        search: params.search,
        category: params.category,
        page: params.page,
        pageSize: params.pageSize ?? 8,
      }),
  });
}
