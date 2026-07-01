import type { AccessCardOption } from "@vms/contracts";
import { api } from "@/data/http/client";

export const accessCardsApi = {
  /** Badge pool for the check-in "Assign pass" dropdown (optionally by zone). */
  list(params?: {
    zone?: string;
    available?: boolean;
  }): Promise<AccessCardOption[]> {
    const q = new URLSearchParams();
    if (params?.zone) q.set("zone", params.zone);
    if (params?.available !== undefined)
      q.set("available", String(params.available));
    const qs = q.toString();
    return api<AccessCardOption[]>(`/access-cards${qs ? `?${qs}` : ""}`);
  },
};
