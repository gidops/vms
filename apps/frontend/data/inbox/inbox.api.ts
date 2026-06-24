import { api } from "@/data/http/client";

export type InboxKind = "all" | "requests" | "alerts";

interface InboxItemBase {
  id: string;
  title: string;
  description: string;
  organization?: string | null;
  createdByName?: string | null;
  notesCount: number;
  createdAt: string;
}

export interface InboxRequestItem extends InboxItemBase {
  kind: "request";
  visitId: string;
  status:
    | "PENDING"
    | "APPROVED"
    | "DENIED"
    | "CHECKED_IN"
    | "CHECKED_OUT"
    | "CANCELLED"
    | "EXPIRED";
}

export interface InboxAlertItem extends InboxItemBase {
  kind: "alert";
  alertId: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export type InboxItem = InboxRequestItem | InboxAlertItem;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const inboxApi = {
  list(
    kind: InboxKind = "all",
    opts?: { search?: string; scope?: "all" | "mine" },
  ): Promise<Paginated<InboxItem>> {
    const params = new URLSearchParams({ kind });
    if (opts?.search) params.set("search", opts.search);
    if (opts?.scope) params.set("scope", opts.scope);
    return api<Paginated<InboxItem>>(`/inbox?${params.toString()}`);
  },
};
