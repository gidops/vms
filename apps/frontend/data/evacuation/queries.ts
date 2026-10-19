import { useQuery } from "@tanstack/react-query";
import { evacuationApi } from "./evacuation.api";

/** The live roll re-fetches every minute while the screen is open. */
export const EVACUATION_REFRESH_MS = 60_000;

export function useEvacuationRoll() {
  return useQuery({
    queryKey: ["visits", "evacuation-roll"] as const,
    queryFn: () => evacuationApi.roll(),
    refetchInterval: EVACUATION_REFRESH_MS,
    refetchIntervalInBackground: true,
  });
}
