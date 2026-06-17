import { api } from "@/data/http/client";

export interface VisitNote {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface VisitRequestDetail {
  id: string;
  visitorId: string;
  hostId: string;
  type: string;
  status:
    | "PENDING"
    | "APPROVED"
    | "DENIED"
    | "CHECKED_IN"
    | "CHECKED_OUT"
    | "CANCELLED"
    | "EXPIRED";
  purpose: string;
  scheduledAt?: string | null;
  createdAt: string;
  source?: string | null;
  createdByName?: string | null;
  visitor: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    organization?: string | null;
  };
  host: {
    id: string;
    department?: string | null;
    office?: string | null;
    user: { id: string; fullName: string; email: string };
  };
  notes: VisitNote[];
}

export const visitsApi = {
  get(id: string): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}`);
  },
  cancel(id: string): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/cancel`, { method: "POST" });
  },
  approve(id: string): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/approve`, { method: "POST" });
  },
  deny(id: string, reason: string): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/deny`, {
      method: "POST",
      body: { reason },
    });
  },
  update(
    id: string,
    input: { purpose?: string; scheduledAt?: string },
  ): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}`, {
      method: "PATCH",
      body: input,
    });
  },
};
