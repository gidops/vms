import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateVisitsInput, VisitStatus, VisitType } from "@vms/contracts";
import { alertsApi, type AlertStatusAction } from "@/data/alerts/alerts.api";
import { inboxApi, type InboxKind } from "@/data/inbox/inbox.api";
import { notesApi } from "@/data/notes/notes.api";
import { visitsApi } from "@/data/visits/visits.api";

type InboxScope = "all" | "mine";

const keys = {
  inbox: (kind: InboxKind, scope: InboxScope) => ["inbox", scope, kind] as const,
  visit: (id: string) => ["visit", id] as const,
  alert: (id: string) => ["alert", id] as const,
  pendingVisits: ["visits", "PENDING"] as const,
};

export function useInbox(kind: InboxKind, opts?: { scope?: InboxScope }) {
  const scope = opts?.scope ?? "all";
  return useQuery({
    queryKey: keys.inbox(kind, scope),
    queryFn: () => inboxApi.list(kind, { scope }),
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

export function useCancelVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => visitsApi.cancel(id),
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
