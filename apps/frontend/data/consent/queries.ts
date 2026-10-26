import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { consentApi, type OptInListParams } from "./consent.api";

export function useOptIns(params: OptInListParams) {
  return useQuery({
    queryKey: ["consent", "opt-ins", params] as const,
    queryFn: () => consentApi.list(params),
    placeholderData: keepPreviousData,
  });
}

/** Refresh the consent list and the Visitors badges after a status change. */
function useInvalidateConsent() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["consent"] }),
      qc.invalidateQueries({ queryKey: ["insights"] }),
    ]);
}

export function useWithdrawConsent() {
  const invalidate = useInvalidateConsent();
  return useMutation({
    mutationFn: (email: string) => consentApi.withdraw(email),
    onSuccess: invalidate,
  });
}

export function useGrantConsent() {
  const invalidate = useInvalidateConsent();
  return useMutation({
    mutationFn: (email: string) => consentApi.grant(email),
    onSuccess: invalidate,
  });
}

export function useExportOptIns() {
  return useMutation({ mutationFn: () => consentApi.exportCsv() });
}
