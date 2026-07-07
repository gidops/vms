import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CheckInVisitInput,
  CheckOutVisitInput,
  CreateVisitsInput,
  VisitStatus,
  VisitType,
} from "@vms/contracts";
import { alertsApi, type AlertStatusAction } from "@/data/alerts/alerts.api";
import {
  inboxApi,
  type InboxKind,
  type InboxListParams,
} from "@/data/inbox/inbox.api";
import { notesApi } from "@/data/notes/notes.api";
import { visitsApi } from "@/data/visits/visits.api";

type InboxScope = "all" | "mine";

/** Filters + pagination the Requests & Alerts feed accepts. */
export type InboxFilters = Omit<InboxListParams, "scope">;

const keys = {
  inbox: (kind: InboxKind, scope: InboxScope, filters: InboxFilters) =>
    ["inbox", scope, kind, filters] as const,
  inboxUnread: (kind: InboxKind, scope: InboxScope) =>
    ["inbox", "unread", scope, kind] as const,
  visit: (id: string) => ["visit", id] as const,
  alert: (id: string) => ["alert", id] as const,
  pendingVisits: ["visits", "PENDING"] as const,
};

export function useInbox(
  kind: InboxKind,
  opts?: { scope?: InboxScope } & InboxFilters,
) {
  const { scope = "all", ...filters } = opts ?? {};
  return useQuery({
    queryKey: keys.inbox(kind, scope, filters),
    queryFn: () => inboxApi.list(kind, { scope, ...filters }),
  });
}

/** Per-user unread count for the "Requests & Alerts" nav bubble. */
export function useInboxUnread(kind: InboxKind, scope: InboxScope = "all") {
  return useQuery({
    queryKey: keys.inboxUnread(kind, scope),
    queryFn: () => inboxApi.unreadCount(kind, { scope }),
  });
}

/** Mark all inbox items read for the current user (called on opening the page). */
export function useMarkInboxSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => inboxApi.markSeen(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });
}

export function useVisitRequest(id: string | null) {
  return useQuery({
    queryKey: keys.visit(id ?? ""),
    queryFn: () => visitsApi.get(id as string),
    enabled: !!id,
  });
}

export function useAlert(id: string | null) {
  return useQuery({
    queryKey: keys.alert(id ?? ""),
    queryFn: () => alertsApi.get(id as string),
    enabled: !!id,
  });
}

/** Pending visit requests for the admin approval queue. */
export function usePendingVisits() {
  return useQuery({
    queryKey: keys.pendingVisits,
    queryFn: () => visitsApi.list({ status: "PENDING", pageSize: 100 }),
  });
}

export interface MyVisitsParams {
  status?: VisitStatus;
  type?: VisitType;
  purpose?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/** Host-scoped visit list powering "My Visits" / "Recent Visitors". */
export function useMyVisits(params: MyVisitsParams = {}) {
  return useQuery({
    queryKey: ["visits", "mine", params] as const,
    queryFn: () => visitsApi.list({ ...params, scope: "mine" }),
  });
}

/** Invalidate every inbox + visits slice + the affected detail after a write. */
function useInvalidate() {
  const qc = useQueryClient();
  return (detailKey?: readonly unknown[]) => {
    void qc.invalidateQueries({ queryKey: ["inbox"] });
    void qc.invalidateQueries({ queryKey: ["visits"] });
    if (detailKey) void qc.invalidateQueries({ queryKey: detailKey });
  };
}

/** VMC creates invite(s) / walk-in(s). */
export function useCreateVisits() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateVisitsInput) => visitsApi.createVisits(input),
    onSuccess: () => invalidate(),
  });
}

/** The guests of one invite/walk-in submission (group check-in sheet). */
export function useVisitGroup(groupId: string | null) {
  return useQuery({
    queryKey: ["visits", "group", groupId] as const,
    queryFn: () => visitsApi.list({ groupId: groupId as string, pageSize: 50 }),
    enabled: !!groupId,
  });
}

/** VMC assigns a badge and checks a visitor in. */
export function useCheckIn(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CheckInVisitInput) => visitsApi.checkIn(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** VMC checks a visitor out and releases the badge. */
export function useCheckOut(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CheckOutVisitInput = {}) =>
      visitsApi.checkOut(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** Admin/super-admin approves a pending request. */
export function useApproveVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => visitsApi.approve(id),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** Admin/super-admin denies a pending request with a reason. */
export function useDenyVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (reason: string) => visitsApi.deny(id, reason),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** Admin approves several visits at once (group approval sheet). */
export function useBulkApproveVisits() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (visitIds: string[]) => visitsApi.bulkApprove(visitIds),
    onSuccess: () => invalidate(),
  });
}

/** Admin denies several visits at once with a shared reason. */
export function useBulkDenyVisits() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: { visitIds: string[]; reason: string }) =>
      visitsApi.bulkDeny(args.visitIds, args.reason),
    onSuccess: () => invalidate(),
  });
}

export function useCancelVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => visitsApi.cancel(id),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** VMC edits a not-yet-approved request (visitor + visit details). */
export function useUpdateVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Parameters<typeof visitsApi.update>[1]) =>
      visitsApi.update(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** Host edits & resubmits a NEEDS_MORE_INFO request → back to PENDING. */
export function useResubmitVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { purpose?: string; scheduledAt?: string } = {}) =>
      visitsApi.resubmit(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** Host rates a completed visit (1-5 stars). */
export function useRateVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { score: number; comment?: string }) =>
      visitsApi.rate(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** Re-send the guest's invite code/QR email. */
export function useResendCode(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => visitsApi.resendCode(id),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

export function useAddNote(target: { visitId?: string; alertId?: string }) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: string) => notesApi.add({ ...target, body }),
    onSuccess: () =>
      invalidate(
        target.visitId
          ? keys.visit(target.visitId)
          : keys.alert(target.alertId ?? ""),
      ),
  });
}

export function useUpdateAlertStatus(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (status: AlertStatusAction) =>
      alertsApi.updateStatus(id, status),
    onSuccess: () => invalidate(keys.alert(id)),
  });
}
