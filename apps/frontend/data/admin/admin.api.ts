import type { AdminOverviewStats } from "@vms/contracts";
import { api } from "@/data/http/client";

export const adminApi = {
  stats(
    params: Record<
      "dateFrom" | "dateTo" | "yesterdayFrom" | "yesterdayTo",
      string
    >,
  ) {
    return api<AdminOverviewStats>(
      `/visits/dashboard/stats?${new URLSearchParams(params)}`,
    );
  },
};
