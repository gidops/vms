import type { NotificationDelivery } from "@vms/contracts";
import { api } from "@/data/http/client";

export const deliveriesApi = {
  list(visitId: string) {
    return api<NotificationDelivery[]>(`/visits/${visitId}/notifications`);
  },
  retry(visitId: string, notificationId: string) {
    return api<NotificationDelivery>(
      `/visits/${visitId}/notifications/${notificationId}/retry`,
      { method: "POST" },
    );
  },
};
