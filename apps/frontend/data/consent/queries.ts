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

export function useWithdrawConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => consentApi.withdraw(email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consent"] }),
  });
}

export function useExportOptIns() {
  return useMutation({ mutationFn: () => consentApi.exportCsv() });
}
