import type { EvacuationRoll } from "@vms/contracts";
import { api } from "@/data/http/client";

export const evacuationApi = {
  roll() {
    return api<EvacuationRoll>(`/visits/evacuation-roll`);
  },
};
