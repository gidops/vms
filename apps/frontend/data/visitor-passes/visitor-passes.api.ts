import type {
  CreatePassesInput,
  CreatePassesResult,
  MarkPassesPrintedInput,
  PassDemandRow,
  RecordPassesInput,
  RecordPassesResult,
  VisitorPassDetail,
  VisitorPassItem,
  VisitorPassStatus,
  VisitorPassSummary,
} from "@vms/contracts";
import { api } from "@/data/http/client";
import type { Wire } from "@/data/insights/insights.api";
import type { Paginated } from "@/data/visits/visits.api";

export type PassItem = Wire<VisitorPassItem>;
export type PassDetail = Wire<VisitorPassDetail>;
export type CreatedBatch = Wire<CreatePassesResult>;

export interface PassListParams {
  zone?: string;
  status?: VisitorPassStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

function query(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  return q ? `?${q}` : "";
}

/** System Admin only: producing passes. Reception assigns them via /access-cards. */
export const visitorPassesApi = {
  list(params: PassListParams = {}) {
    return api<Paginated<PassItem>>(`/visitor-passes${query(params)}`);
  },
  summary() {
    return api<VisitorPassSummary>(`/visitor-passes/summary`);
  },
  demand(days: number) {
    return api<PassDemandRow[]>(`/visitor-passes/demand?days=${days}`);
  },
  get(id: string) {
    return api<PassDetail>(`/visitor-passes/${id}`);
  },
  createBatch(body: CreatePassesInput) {
    return api<CreatedBatch>(`/visitor-passes/batches`, {
      method: "POST",
      body,
    });
  },
  record(body: RecordPassesInput) {
    return api<RecordPassesResult>(`/visitor-passes/record`, {
      method: "POST",
      body,
    });
  },
  printed(body: MarkPassesPrintedInput) {
    return api<{ printed: number; reprinted: number }>(
      `/visitor-passes/printed`,
      { method: "POST", body },
    );
  },
  retire(id: string, note?: string) {
    return api<PassDetail>(`/visitor-passes/${id}/retire`, {
      method: "POST",
      body: note ? { note } : {},
    });
  },
  reactivate(id: string) {
    return api<PassDetail>(`/visitor-passes/${id}/reactivate`, {
      method: "POST",
    });
  },
};
