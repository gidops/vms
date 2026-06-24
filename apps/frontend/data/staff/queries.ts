import { useQuery } from "@tanstack/react-query";
import { staffApi } from "./staff.api";

const keys = {
  stats: ["staff", "stats"] as const,
  activity: (date?: string) => ["staff", "activity", date ?? "all"] as const,
};

/** Today's Schedule headline counts (host-scoped). */
export function useStaffStats() {
  return useQuery({
    queryKey: keys.stats,
    queryFn: () => staffApi.stats(),
  });
}

/** "Recent Updates" activity feed (host-scoped), optionally for a single day. */
export function useStaffActivityFeed(date?: string) {
  return useQuery({
    queryKey: keys.activity(date),
    queryFn: () => staffApi.activityFeed({ date, pageSize: 8 }),
  });
}
