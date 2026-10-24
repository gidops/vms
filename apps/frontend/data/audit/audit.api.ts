import type { AuditCategory, AuditItem } from "@vms/contracts";
import { api, apiDownload } from "@/data/http/client";
import type { Wire } from "@/data/insights/insights.api";
import type { Paginated } from "@/data/visits/visits.api";

export type AuditRow = Wire<AuditItem>;

/** WAT calendar days `from`..`to` (YYYY-MM-DD) plus optional filters. */
export interface AuditParams {
  from: string;
  to: string;
  category?: AuditCategory;
  search?: string;
  page?: number;
  pageSize?: number;
}

function query(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

/** Operations → Audit trail. System Admin only. */
export const auditApi = {
  list(params: AuditParams) {
    return api<Paginated<AuditRow>>(`/audit?${query(params)}`);
  },
  /** The filtered trail as CSV (no paging); the export itself is audited. */
  exportCsv({ page: _page, pageSize: _size, ...filters }: AuditParams) {
    return apiDownload(
      `/audit/export.csv?${query(filters)}`,
      `aatc-audit_${filters.from}_${filters.to}.csv`,
    );
  },
};
