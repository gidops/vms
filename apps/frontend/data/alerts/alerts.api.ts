import { api } from "@/data/http/client";
import type { VisitNote } from "@/data/visits/visits.api";

export interface AlertDetail {
  id: string;
  visitId?: string | null;
  visitorId?: string | null;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  reason: string;
  category?: string | null;
  createdAt: string;
  visitor?: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    organization?: string | null;
  } | null;
  notes: VisitNote[];
}

export type AlertStatusAction = "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

export const alertsApi = {
  get(id: string): Promise<AlertDetail> {
    return api<AlertDetail>(`/alerts/${id}`);
  },
  updateStatus(id: string, status: AlertStatusAction): Promise<AlertDetail> {
    return api<AlertDetail>(`/alerts/${id}`, {
      method: "PATCH",
      body: { status },
    });
  },
};
