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

export function useInboxUnread(
  kind: InboxKind,
  scope: InboxScope = "all",
  enabled = true,
) {
  return useQuery({
    queryKey: keys.inboxUnread(kind, scope),
    queryFn: () => inboxApi.unreadCount(kind, { scope }),
    enabled,
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
  /** Which date column `dateFrom`/`dateTo` filter on (default `scheduledAt`). */
  dateField?: "scheduledAt" | "createdAt";
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

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

export function useCheckIn(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CheckInVisitInput) => visitsApi.checkIn(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

export function useCheckOut(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CheckOutVisitInput = {}) =>
      visitsApi.checkOut(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

export function useApproveVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => visitsApi.approve(id),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

export function useDenyVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (reason: string) => visitsApi.deny(id, reason),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

export function useBulkApproveVisits() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (visitIds: string[]) => visitsApi.bulkApprove(visitIds),
    onSuccess: () => invalidate(),
  });
}

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

export function useUpdateVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Parameters<typeof visitsApi.update>[1]) =>
      visitsApi.update(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** Host edits & resubmits a REVIEW_REQUESTED request → back to PENDING. */
export function useResubmitVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { purpose?: string; scheduledAt?: string } = {}) =>
      visitsApi.resubmit(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** Security Manager/admin flags a visit → FLAGGED + a SECURITY_REVIEW alert (blocks check-in). */
export function useFlagVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Parameters<typeof visitsApi.flag>[1]) =>
      visitsApi.flag(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** Security Manager/admin requests more info → REVIEW_REQUESTED + an ADDITIONAL_INFO alert. */
export function useRequestInfo(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Parameters<typeof visitsApi.requestInfo>[1]) =>
      visitsApi.requestInfo(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

/** Keyed by the visit so its sheet refreshes; resolving clears the visit's hold. */
export function useResolveAlert(visitId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: { alertId: string; status: AlertStatusAction }) =>
      alertsApi.updateStatus(args.alertId, args.status),
    onSuccess: () => invalidate(keys.visit(visitId)),
  });
}

export function useRateVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { score: number; comment?: string }) =>
      visitsApi.rate(id, input),
    onSuccess: () => invalidate(keys.visit(id)),
  });
}

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
