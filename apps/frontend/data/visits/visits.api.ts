import type { CreateVisitsInput, VisitStatus, VisitType } from "@vms/contracts";
import { api } from "@/data/http/client";

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** A row in the admin approval queue. */
export interface VisitListItem {
  id: string;
  type: string;
  status: VisitRequestDetail["status"];
  purpose: string;
  floor?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  createdByName?: string | null;
  visitor: {
    id: string;
    fullName: string;
    email: string;
    organization?: string | null;
  };
  host: { id: string; user: { id: string; fullName: string; email: string } };
}

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
    | "NEEDS_MORE_INFO"
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
  /** Create invite(s) / walk-in(s) — one visit per visitor. */
  createVisits(input: CreateVisitsInput): Promise<VisitRequestDetail[]> {
    return api<VisitRequestDetail[]>(`/visits`, { method: "POST", body: input });
  },
  /**
   * Visit list. The admin queue filters by status; the staff dashboard passes
   * `scope: "mine"` (host-scoped) plus the type/purpose/date facets.
   */
  list(params?: {
    status?: VisitStatus;
    scope?: "all" | "mine";
    type?: VisitType;
    purpose?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<VisitListItem>> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.scope) q.set("scope", params.scope);
    if (params?.type) q.set("type", params.type);
    if (params?.purpose) q.set("purpose", params.purpose);
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params?.dateTo) q.set("dateTo", params.dateTo);
    if (params?.page) q.set("page", String(params.page));
    if (params?.pageSize) q.set("pageSize", String(params.pageSize));
    const qs = q.toString();
    return api<Paginated<VisitListItem>>(`/visits${qs ? `?${qs}` : ""}`);
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
  /** Host edits & resubmits a NEEDS_MORE_INFO request → back to PENDING. */
  resubmit(
    id: string,
    input: { purpose?: string; scheduledAt?: string } = {},
  ): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/resubmit`, {
      method: "POST",
      body: input,
    });
  },
};
