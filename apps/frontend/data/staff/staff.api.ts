import { api } from "@/data/http/client";

export interface StaffDashboardStats {
  expectedToday: number;
  awaitingApproval: number;
  onsite: number;
}

export type StaffActivityCategory =
  | "ARRIVAL_UPDATE"
  | "CSO_FEEDBACK"
  | "REQUEST_UPDATE"
  | "VISIT_STATUS"
  | "SECURITY_ALERT";

export interface StaffActivityItem {
  id: string;
  category: StaffActivityCategory;
  title: string;
  body: string;
  subjectName?: string | null;
  visitId?: string | null;
  alertId?: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const staffApi = {
  stats(): Promise<StaffDashboardStats> {
    return api<StaffDashboardStats>(`/staff/dashboard/stats`);
  },
  /** Recent Updates feed; optionally narrowed to a single ISO day (YYYY-MM-DD). */
  activityFeed(opts?: {
    date?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<StaffActivityItem>> {
    const q = new URLSearchParams();
    if (opts?.date) q.set("date", opts.date);
    if (opts?.page) q.set("page", String(opts.page));
    if (opts?.pageSize) q.set("pageSize", String(opts.pageSize));
    const qs = q.toString();
    return api<Paginated<StaffActivityItem>>(
      `/staff/activity-feed${qs ? `?${qs}` : ""}`,
    );
  },
};
