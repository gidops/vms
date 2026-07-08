import { useQuery } from "@tanstack/react-query";
import type { StaffActivityCategory } from "./staff.api";
import { staffApi } from "./staff.api";

export interface ActivityFeedParams {
  date?: string;
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
      p.page ?? 1,
      p.pageSize ?? 8,
    ] as const,
};

/** Today's Schedule headline counts (host-scoped). */
export function useStaffStats() {
  return useQuery({
    queryKey: keys.stats,
    queryFn: () => staffApi.stats(),
  });
}

/**
 * Activity feed (host-scoped). Powers both the dashboard "Recent Updates" card
 * (default page of 8) and the full "All Updates" page (larger page, then filtered
 * by category client-side until the backend gains a category param — see Phase 7).
 */
export function useStaffActivityFeed(params: ActivityFeedParams = {}) {
  return useQuery({
    queryKey: keys.activity(params),
    queryFn: () =>
      staffApi.activityFeed({
        date: params.date,
        category: params.category,
        page: params.page,
        pageSize: params.pageSize ?? 8,
      }),
  });
}
