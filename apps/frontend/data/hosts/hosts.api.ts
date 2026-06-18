import type { HostOption } from "@vms/contracts";
import { api } from "@/data/http/client";

export const hostsApi = {
  /** Selectable hosts (STAFF users) for the invite / walk-in forms. */
  list(): Promise<HostOption[]> {
    return api<HostOption[]>(`/hosts`);
  },
};
