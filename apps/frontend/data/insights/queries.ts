import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { InsightsRange } from "@vms/contracts";
import {
  insightsApi,
  type InsightsHistoryParams,
  type InsightsVisitorsParams,
} from "./insights.api";

/** On-site numbers move all day; refresh the overview every minute. */
const OVERVIEW_REFRESH_MS = 60_000;

export function useInsightsOverview() {
  return useQuery({
    queryKey: ["insights", "overview"] as const,
    queryFn: () => insightsApi.overview(),
    refetchInterval: OVERVIEW_REFRESH_MS,
  });
}

export function useInsightsHistory(params: InsightsHistoryParams) {
  return useQuery({
    queryKey: ["insights", "history", params] as const,
    queryFn: () => insightsApi.history(params),
    placeholderData: keepPreviousData,
  });
}

export function useInsightsVisitors(params: InsightsVisitorsParams) {
  return useQuery({
    queryKey: ["insights", "visitors", params] as const,
    queryFn: () => insightsApi.visitors(params),
    placeholderData: keepPreviousData,
  });
}

export function useInsightsVisitor(id: string | null) {
  return useQuery({
    queryKey: ["insights", "visitor", id] as const,
    queryFn: () => insightsApi.visitor(id!),
    enabled: !!id,
  });
}

export function useInsightsAnalytics(range: InsightsRange) {
  return useQuery({
    queryKey: ["insights", "analytics", range] as const,
    queryFn: () => insightsApi.analytics(range),
    placeholderData: keepPreviousData,
  });
}
