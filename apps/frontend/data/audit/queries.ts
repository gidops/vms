import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { auditApi, type AuditParams } from "./audit.api";

export function useAuditTrail(params: AuditParams, enabled = true) {
  return useQuery({
    queryKey: ["audit", params] as const,
    queryFn: () => auditApi.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useExportAudit() {
  return useMutation({
    mutationFn: (params: AuditParams) => auditApi.exportCsv(params),
  });
}
