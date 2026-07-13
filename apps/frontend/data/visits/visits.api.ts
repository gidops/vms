import type {
  AlertStatus,
  AlertType,
  CheckInVisitInput,
  CheckOutVisitInput,
  CreateVisitsInput,
  FlagVisitInput,
  RequestInfoInput,
  RiskLevel,
  VisitStatus,
  VisitType,
} from "@vms/contracts";
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
  groupId?: string | null;
  referenceCode?: string | null;
  gateValidatedAt?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  createdAt: string;
  createdByName?: string | null;
  /** True when this row is a group visit's representative (the group signal). */
  isGroupVisit: boolean;
  /** Group display name / contact — email or phone (group visits only). */
  groupName?: string | null;
  groupContact?: string | null;
  /** For a group's representative row, the number of guests in the group. */
  groupSize: number;
  visitor: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    organization?: string | null;
  };
  host: {
    id: string;
    user: { id: string; fullName: string; email: string };
  } | null;
}

/** The physical badge currently assigned to a visit (set at check-in). */
export interface VisitPass {
  cardNumber: string;
  zone?: string | null;
  status: string;
  assignedAt?: string | null;
}

export interface VisitNote {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** A security alert raised against a visit (flag / more-info / restricted match). */
export interface VisitAlert {
  id: string;
  visitId?: string | null;
  visitorId?: string | null;
  type: AlertType;
  level: RiskLevel;
  status: AlertStatus;
  reason: string;
  category?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisitRequestDetail {
  id: string;
  visitorId: string;
  hostId: string;
  type: string;
  /** Derived from the shared contract enum so new statuses (FLAGGED, …) stay in sync. */
  status: VisitStatus;
  purpose: string;
  floor?: string | null;
  scheduledAt?: string | null;
  groupId?: string | null;
  isGroupVisit?: boolean;
  groupName?: string | null;
  groupContact?: string | null;
  referenceCode?: string | null;
  qrCode?: string | null;
  gateValidatedAt?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  createdAt: string;
  source?: string | null;
  createdById?: string | null;
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
  } | null;
  pass?: VisitPass | null;
  checkedInByName?: string | null;
  checkedOutByName?: string | null;
  notes: VisitNote[];
  /** Security alerts on this visit; the sheet renders the stripe + Alert Summary from the open one. */
  alerts: VisitAlert[];
}

export const visitsApi = {
  get(id: string): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}`);
  },
  /** Create invite(s) / walk-in(s) — one visit per visitor. */
  createVisits(input: CreateVisitsInput): Promise<VisitRequestDetail[]> {
    return api<VisitRequestDetail[]>(`/visits`, {
      method: "POST",
      body: input,
    });
  },
  /**
   * Visit list. The admin queue filters by status; the staff dashboard passes
   * `scope: "mine"` (host-scoped) plus the type/purpose/date facets.
   */
  list(params?: {
    status?: VisitStatus;
    /** Restrict to several statuses (e.g. the VMC board's APPROVED/CHECKED_IN/CHECKED_OUT). */
    statuses?: VisitStatus[];
    scope?: "all" | "mine";
    type?: VisitType;
    purpose?: string;
    groupId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<VisitListItem>> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.statuses?.length) q.set("statuses", params.statuses.join(","));
    if (params?.scope) q.set("scope", params.scope);
    if (params?.type) q.set("type", params.type);
    if (params?.purpose) q.set("purpose", params.purpose);
    if (params?.groupId) q.set("groupId", params.groupId);
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
  /** VMC check-in: assign a physical badge to an approved visit. */
  checkIn(id: string, input: CheckInVisitInput): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/check-in`, {
      method: "POST",
      body: input,
    });
  },
  /** VMC check-out: release the badge and mark the visitor off-site. */
  checkOut(
    id: string,
    input: CheckOutVisitInput = {},
  ): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/check-out`, {
      method: "POST",
      body: input,
    });
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
  /** Approve several visits at once (group approval sheet — Approve All/Selected). */
  bulkApprove(visitIds: string[]): Promise<VisitRequestDetail[]> {
    return api<VisitRequestDetail[]>(`/visits/bulk-approve`, {
      method: "POST",
      body: { visitIds },
    });
  },
  /** Deny several visits at once with a shared reason. */
  bulkDeny(visitIds: string[], reason: string): Promise<VisitRequestDetail[]> {
    return api<VisitRequestDetail[]>(`/visits/bulk-deny`, {
      method: "POST",
      body: { visitIds, reason },
    });
  },
  /** VMC edit of a not-yet-approved request (visitor + visit details). */
  update(
    id: string,
    input: {
      fullName?: string;
      email?: string;
      phone?: string;
      organization?: string;
      hostUserId?: string;
      floor?: string;
      purpose?: string;
      scheduledAt?: string;
    },
  ): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}`, {
      method: "PATCH",
      body: input,
    });
  },
  /** Host rates a completed (checked-out) visit — 1-5 stars + optional comment. */
  rate(
    id: string,
    input: { score: number; comment?: string },
  ): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/rating`, {
      method: "POST",
      body: input,
    });
  },
  /** Re-send the invite code/QR email to the guest. */
  resendCode(id: string): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/resend-code`, {
      method: "POST",
    });
  },
  /** Host edits & resubmits a REVIEW_REQUESTED request → back to PENDING. */
  resubmit(
    id: string,
    input: { purpose?: string; scheduledAt?: string } = {},
  ): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/resubmit`, {
      method: "POST",
      body: input,
    });
  },
  /** CSO/admin flags a visit → FLAGGED + a SECURITY_REVIEW alert (blocks check-in). */
  flag(id: string, input: FlagVisitInput): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/flag`, {
      method: "POST",
      body: input,
    });
  },
  /** CSO/admin requests more info → REVIEW_REQUESTED + an ADDITIONAL_INFO alert. */
  requestInfo(
    id: string,
    input: RequestInfoInput,
  ): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/request-info`, {
      method: "POST",
      body: input,
    });
  },
};
