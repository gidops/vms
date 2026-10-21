import type { ExportVisitsQuery } from "@vms/contracts";
import { apiDownload } from "@/data/http/client";

export const reportsApi = {
  exportVisits(q: ExportVisitsQuery) {
    const qs = new URLSearchParams({
      from: q.from,
      to: q.to,
      format: q.format,
    });
    return apiDownload(
      `/visits/export?${qs.toString()}`,
      `aatc-visitors_${q.from}_${q.to}.${q.format}`,
    );
  },
};
