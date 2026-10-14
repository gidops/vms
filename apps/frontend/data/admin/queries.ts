import { useQueries, useQuery } from "@tanstack/react-query";
import type { VisitStatus } from "@vms/contracts";
import { inboxApi } from "@/data/inbox/inbox.api";
import { visitsApi } from "@/data/visits/visits.api";

/**
 * Admin overview data. There is no dedicated admin stats endpoint yet, so the
 * counts are read from the visit list's `total` (pageSize 1) with status/date
 * filters, and the chart from today's checked-in/out visits. All "today"
 * windows use the browser's local day over `scheduledAt`.
 */

/** Visits that count as "visitors" for the day (excludes denied/cancelled/expired). */
const ACTIVE_STATUSES: VisitStatus[] = [
  "PENDING",
  "REVIEW_REQUESTED",
  "FLAGGED",
  "APPROVED",
  "CHECKED_IN",
  "CHECKED_OUT",
];

/** First/last hour shown on the traffic chart (local time, inclusive). */
export const TRAFFIC_START_HOUR = 8;
export const TRAFFIC_END_HOUR = 17;

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

type CountParams = Parameters<typeof visitsApi.list>[0];

const countQuery = (key: string, params: CountParams) => ({
  queryKey: ["admin", "count", key, params] as const,
  queryFn: async () => (await visitsApi.list({ ...params, pageSize: 1 })).total,
});

export interface AdminOverviewStats {
  visitorsToday: number;
  visitorsYesterday: number;
  expected: number;
  pending: number;
  reviewRequested: number;
  onsite: number;
  checkedOutToday: number;
  checkedInToday: number;
  deniedToday: number;
}

/** Headline counts for the stat cards and the status breakdown. */
export function useAdminOverviewStats() {
  const today = dayWindow(0);
  const yesterday = dayWindow(-1);
  const results = useQueries({
    queries: [
      countQuery("visitorsToday", { statuses: ACTIVE_STATUSES, ...today }),
      countQuery("visitorsYesterday", {
        statuses: ACTIVE_STATUSES,
        ...yesterday,
      }),
      countQuery("expected", { status: "APPROVED", ...today }),
      countQuery("pending", { status: "PENDING" }),
      countQuery("reviewRequested", { status: "REVIEW_REQUESTED" }),
      countQuery("onsite", { status: "CHECKED_IN" }),
      countQuery("checkedOutToday", { status: "CHECKED_OUT", ...today }),
      countQuery("checkedInToday", { status: "CHECKED_IN", ...today }),
      countQuery("deniedToday", { status: "DENIED", ...today }),
    ],
  });
  const [
    visitorsToday,
    visitorsYesterday,
    expected,
    pending,
    reviewRequested,
    onsite,
    checkedOutToday,
    checkedInToday,
    deniedToday,
  ] = results.map((r) => r.data ?? 0);
  const data: AdminOverviewStats = {
    visitorsToday,
    visitorsYesterday,
    expected,
    pending,
    reviewRequested,
    onsite,
    checkedOutToday,
    checkedInToday,
    deniedToday,
  };
  return {
    data,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}

/**
 * Check-ins per hour (TRAFFIC_START_HOUR…TRAFFIC_END_HOUR) for a local day
 * (`dayOffset` 0 = today, −1 = yesterday). Group visits are one row in the
 * list, so each row is weighted by its guest count.
 */
export function useTraffic(dayOffset: 0 | -1 = 0) {
  const day = dayWindow(dayOffset);
  return useQuery({
    queryKey: ["admin", "traffic", day.dateFrom] as const,
    queryFn: async () => {
      const page = await visitsApi.list({
        statuses: ["CHECKED_IN", "CHECKED_OUT"],
        ...day,
        pageSize: 100,
      });
      const buckets = new Map<number, number>();
      for (let h = TRAFFIC_START_HOUR; h <= TRAFFIC_END_HOUR; h++) {
        buckets.set(h, 0);
      }
      for (const v of page.items) {
        if (!v.checkInAt) continue;
        const hour = new Date(v.checkInAt).getHours();
        if (buckets.has(hour)) {
          buckets.set(
            hour,
            (buckets.get(hour) ?? 0) + Math.max(1, v.groupSize),
          );
        }
      }
      return [...buckets].map(([hour, value]) => ({ hour, value }));
    },
  });
}

/** Today's visitors table (scheduled today; the API orders earliest first), searchable. */
export function useTodaysVisitors(search: string, pageSize = 5) {
  const today = dayWindow(0);
  return useQuery({
    queryKey: ["admin", "todaysVisitors", today.dateFrom, search, pageSize],
    queryFn: () =>
      visitsApi.list({
        ...today,
        search: search || undefined,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });
}

/** Approved/pending visits still to arrive today, soonest first. */
export function useUpcomingVisits(pageSize = 7) {
  const { dateTo } = dayWindow(0);
  // Round "now" to the minute so the key (and request) is stable across renders.
  const from = new Date();
  from.setSeconds(0, 0);
  const dateFrom = from.toISOString();
  return useQuery({
    queryKey: ["admin", "upcoming", dateFrom, pageSize] as const,
    queryFn: () =>
      visitsApi.list({
        statuses: ["APPROVED", "PENDING"],
        dateFrom,
        dateTo,
        pageSize,
      }),
  });
}

/** Latest requests + security alerts across the site (no read side effects). */
export function useRecentActivity(pageSize = 6) {
  return useQuery({
    queryKey: ["admin", "activity", pageSize] as const,
    queryFn: () => inboxApi.list("all", { scope: "all", pageSize }),
  });
}
