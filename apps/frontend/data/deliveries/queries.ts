import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deliveriesApi } from "./deliveries.api";

const key = (visitId: string) => ["visit", visitId, "deliveries"] as const;

export function useVisitDeliveries(visitId: string, enabled = true) {
  return useQuery({
    queryKey: key(visitId),
    queryFn: () => deliveriesApi.list(visitId),
    enabled,
  });
}

export function useRetryDelivery(visitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      deliveriesApi.retry(visitId, notificationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(visitId) }),
  });
}
