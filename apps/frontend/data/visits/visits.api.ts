import type {
  AlertStatus,
  DeskStats,
  EvacuationAssistType,
  AlertType,
  CheckInVisitInput,
  CheckOutVisitInput,
  CreateVisitsInput,
  FlagVisitInput,
  HeldRfidCard as HeldRfidCardContract,
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

/** The visitor's active personalised RFID card (dates arrive as ISO strings). */
export type HeldRfidCard = Omit<HeldRfidCardContract, "validUntil"> & {
  validUntil: string;
};

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
  /** Where the visit came from (e.g. "QR_SELF_REGISTER" for the desk QR). */
  source?: string | null;
  /** True for a group visit's representative row. */
  isGroupVisit: boolean;
  groupName?: string | null;
  groupContact?: string | null;
  groupSize: number;
  visitor: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    organization?: string | null;
  };
  rfidCard?: HeldRfidCard | null;
  host: {
    id: string;
    department?: string | null;
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
  /** Intake answer; null = legacy visit, never asked. */
  needsEvacuationAssist?: boolean | null;
  evacuationAssistTypes?: EvacuationAssistType[];
  evacuationAssistOther?: string | null;
  /** Comms-consent answer given at this visit; null = legacy. */
  commsConsent?: boolean | null;
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
  /** The stored visitor record, when this visit was registered under other details. */
  storedVisitor?: { fullName: string; organization: string | null } | null;
  host: {
    id: string;
    department?: string | null;
    office?: string | null;
    user: { id: string; fullName: string; email: string };
  } | null;
  pass?: VisitPass | null;
  rfidCard?: HeldRfidCard | null;
  checkedInByName?: string | null;
  checkedOutByName?: string | null;
  notes: VisitNote[];
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
  list(params?: {
    status?: VisitStatus;
    statuses?: VisitStatus[];
    scope?: "all" | "mine";
    type?: VisitType;
    purpose?: string;
    groupId?: string;
    dateFrom?: string;
    dateTo?: string;
    /** Which date column `dateFrom`/`dateTo` filter on (default `scheduledAt`). */
    dateField?: "scheduledAt" | "createdAt";
    /** Free-text search (guest/host/floor/pass id). */
    search?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
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
    if (params?.dateField) q.set("dateField", params.dateField);
    if (params?.search) q.set("search", params.search);
    if (params?.sortBy) q.set("sortBy", params.sortBy);
    if (params?.sortDir) q.set("sortDir", params.sortDir);
    if (params?.page) q.set("page", String(params.page));
    if (params?.pageSize) q.set("pageSize", String(params.pageSize));
    const qs = q.toString();
    return api<Paginated<VisitListItem>>(`/visits${qs ? `?${qs}` : ""}`);
  },
  deskStats(): Promise<DeskStats> {
    return api<DeskStats>(`/visits/dashboard/desk-stats`);
  },
  cancel(id: string): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/cancel`, { method: "POST" });
  },
  checkIn(id: string, input: CheckInVisitInput): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/check-in`, {
      method: "POST",
      body: input,
    });
  },
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
  bulkApprove(visitIds: string[]): Promise<VisitRequestDetail[]> {
    return api<VisitRequestDetail[]>(`/visits/bulk-approve`, {
      method: "POST",
      body: { visitIds },
    });
  },
  bulkDeny(visitIds: string[], reason: string): Promise<VisitRequestDetail[]> {
    return api<VisitRequestDetail[]>(`/visits/bulk-deny`, {
      method: "POST",
      body: { visitIds, reason },
    });
  },
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
      needsEvacuationAssist?: boolean;
      evacuationAssistTypes?: EvacuationAssistType[];
      evacuationAssistOther?: string;
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
  /** Security Manager/admin flags a visit → FLAGGED + a SECURITY_REVIEW alert (blocks check-in). */
  flag(id: string, input: FlagVisitInput): Promise<VisitRequestDetail> {
    return api<VisitRequestDetail>(`/visits/${id}/flag`, {
      method: "POST",
      body: input,
    });
  },
  /** Security Manager/admin requests more info → REVIEW_REQUESTED + an ADDITIONAL_INFO alert. */
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
