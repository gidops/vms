import { useQuery } from "@tanstack/react-query";
import { accessCardsApi } from "./access-cards.api";

/** Available badges for the check-in "Assign pass" dropdown. */
export function useAvailableCards(opts?: { zone?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ["access-cards", "available", opts?.zone ?? null] as const,
    queryFn: () => accessCardsApi.list({ zone: opts?.zone, available: true }),
    enabled: opts?.enabled ?? true,
  });
}
