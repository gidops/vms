import { useQuery } from "@tanstack/react-query";
import { visitsApi } from "./visits.api";

/** Live VMC desk counters (on site, checked in and out today). */
export function useDeskStats() {
  return useQuery({
    queryKey: ["visits", "dashboard", "desk-stats"] as const,
    queryFn: () => visitsApi.deskStats(),
    refetchInterval: 30_000,
  });
}

/** One page of the VMC records board; keeps the previous page while the next loads. */
export function useVmcBoardVisits(
  params: Parameters<typeof visitsApi.list>[0],
) {
  return useQuery({
    queryKey: ["visits", "dashboard", "board", params] as const,
    queryFn: () => visitsApi.list(params),
    placeholderData: (prev) => prev,
  });
}
