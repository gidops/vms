import { useQuery } from "@tanstack/react-query";
import { evacuationApi } from "./evacuation.api";

/**
 * The live roll re-fetches every minute while the screen is open, and is never
 * served from cache: a safety list must be current the moment it's opened.
 */
export const EVACUATION_REFRESH_MS = 60_000;

export function useEvacuationRoll() {
  return useQuery({
    queryKey: ["visits", "evacuation-roll"] as const,
    queryFn: () => evacuationApi.roll(),
    refetchInterval: EVACUATION_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}
