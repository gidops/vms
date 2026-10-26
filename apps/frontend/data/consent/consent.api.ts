import type {
  ConsentStatusFilter,
  GrantConsentResult,
  OptInItem,
  Paginated,
  WithdrawConsentResult,
} from "@vms/contracts";
import { api, apiDownload } from "@/data/http/client";

export interface OptInListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  /** Current status to list: consented (default), not consented, or both. */
  status?: ConsentStatusFilter;
}

export const consentApi = {
  list(params: OptInListParams = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    const q = qs.toString();
    return api<Paginated<OptInItem>>(`/consent/opt-ins${q ? `?${q}` : ""}`);
  },
  exportCsv() {
    return apiDownload(`/consent/opt-ins.csv`, "aatc-email-consent.csv");
  },
  withdraw(email: string) {
    return api<WithdrawConsentResult>(`/consent/withdraw`, {
      method: "POST",
      body: { email },
    });
  },
  /** Opt a visitor back in on their behalf (System Admin, consent:grant). */
  grant(email: string) {
    return api<GrantConsentResult>(`/consent/grant`, {
      method: "POST",
      body: { email },
    });
  },
};
