import type { AdminOverviewStats, AdminTrafficPoint } from "@vms/contracts";
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
  traffic(params: Record<"dateFrom" | "dateTo" | "timeZone", string>) {
    return api<AdminTrafficPoint[]>(
      `/visits/dashboard/traffic?${new URLSearchParams(params)}`,
    );
  },
};
