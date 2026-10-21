import type {
  OptInItem,
  Paginated,
  WithdrawConsentResult,
} from "@vms/contracts";
import { api, apiDownload } from "@/data/http/client";

export interface OptInListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export const consentApi = {
  list(params: OptInListParams = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search) qs.set("search", params.search);
    const q = qs.toString();
    return api<Paginated<OptInItem>>(`/consent/opt-ins${q ? `?${q}` : ""}`);
  },
  exportCsv() {
    return apiDownload(`/consent/opt-ins.csv`, "aatc-comms-opt-ins.csv");
  },
  withdraw(email: string) {
    return api<WithdrawConsentResult>(`/consent/withdraw`, {
      method: "POST",
      body: { email },
    });
  },
};
