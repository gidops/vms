import type { VisitType } from "@vms/contracts";
import { api } from "@/data/http/client";

export type InboxKind = "all" | "requests" | "alerts";

interface InboxItemBase {
  id: string;
  organization?: string | null;
  createdByName?: string | null;
  notesCount: number;
  createdAt: string;
  /** Last activity time — drives recency sort, "x min ago", and the unread flag. */
  updatedAt: string;
  /** True when the item changed after the user last opened Requests & Alerts. */
  unread: boolean;
}

export interface InboxRequestItem extends InboxItemBase {
  kind: "request";
  visitId: string;
  status:
    | "PENDING"
    | "NEEDS_MORE_INFO"
    | "APPROVED"
    | "DENIED"
    | "CHECKED_IN"
    | "CHECKED_OUT"
    | "CANCELLED"
    | "EXPIRED";
  visitorName: string;
  hostName?: string | null;
  type: VisitType;
  purpose: string;
}

export interface InboxAlertItem extends InboxItemBase {
  kind: "alert";
  alertId: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category?: string | null;
  reason: string;
  visitorName?: string | null;
}

export type InboxItem = InboxRequestItem | InboxAlertItem;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface InboxListParams {
  search?: string;
  scope?: "all" | "mine";
  status?: string;
  purpose?: string;
  type?: VisitType;
  page?: number;
  pageSize?: number;
}

function inboxParams(kind: InboxKind, opts?: InboxListParams): URLSearchParams {
  const params = new URLSearchParams({ kind });
  if (opts?.search) params.set("search", opts.search);
  if (opts?.scope) params.set("scope", opts.scope);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.purpose) params.set("purpose", opts.purpose);
  if (opts?.type) params.set("type", opts.type);
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
  return params;
}

export const inboxApi = {
  list(
    kind: InboxKind = "all",
    opts?: InboxListParams,
  ): Promise<Paginated<InboxItem>> {
    return api<Paginated<InboxItem>>(`/inbox?${inboxParams(kind, opts)}`);
  },
  /** Per-user unread count for the nav bubble (honours kind + scope). */
  unreadCount(
    kind: InboxKind = "all",
    opts?: Pick<InboxListParams, "scope">,
  ): Promise<{ unread: number }> {
    const params = new URLSearchParams({ kind });
    if (opts?.scope) params.set("scope", opts.scope);
    return api<{ unread: number }>(`/inbox/unread-count?${params}`);
  },
  /** Mark everything read for the current user (called on opening the page). */
  markSeen(): Promise<{ seenAt: string }> {
    return api<{ seenAt: string }>(`/inbox/seen`, { method: "POST" });
  },
};
