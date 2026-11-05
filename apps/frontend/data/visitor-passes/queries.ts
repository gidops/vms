import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CreatePassesInput,
  MarkPassesPrintedInput,
  RecordPassesInput,
} from "@vms/contracts";
import { visitorPassesApi, type PassListParams } from "./visitor-passes.api";

const KEY = ["visitor-passes"] as const;

export function useVisitorPasses(params: PassListParams) {
  return useQuery({
    queryKey: [...KEY, "list", params] as const,
    queryFn: () => visitorPassesApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useVisitorPassSummary() {
  return useQuery({
    queryKey: [...KEY, "summary"] as const,
    queryFn: () => visitorPassesApi.summary(),
  });
}

export function usePassDemand(days: number, enabled = true) {
  return useQuery({
    queryKey: [...KEY, "demand", days] as const,
    queryFn: () => visitorPassesApi.demand(days),
    enabled,
  });
}

export function useVisitorPass(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "detail", id] as const,
    queryFn: () => visitorPassesApi.get(id!),
    enabled: !!id,
  });
}

/** Every write refreshes the lists, counts, detail, the VMC pass picker and the audit trail. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: ["access-cards"] });
    void qc.invalidateQueries({ queryKey: ["audit"] });
  };
}

export function useCreatePasses() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CreatePassesInput) => visitorPassesApi.createBatch(body),
    onSuccess: invalidate,
  });
}

export function useRecordPasses() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: RecordPassesInput) => visitorPassesApi.record(body),
    onSuccess: invalidate,
  });
}

export function useMarkPassesPrinted() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: MarkPassesPrintedInput) =>
      visitorPassesApi.printed(body),
    onSuccess: invalidate,
  });
}

export function useRetirePass() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      visitorPassesApi.retire(id, note),
    onSuccess: invalidate,
  });
}

export function useReactivatePass() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => visitorPassesApi.reactivate(id),
    onSuccess: invalidate,
  });
}
