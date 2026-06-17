import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertsApi, type AlertStatusAction } from "@/data/alerts/alerts.api";
import { inboxApi, type InboxKind } from "@/data/inbox/inbox.api";
import { notesApi } from "@/data/notes/notes.api";
import { visitsApi } from "@/data/visits/visits.api";

const keys = {
  inbox: (kind: InboxKind) => ["inbox", kind] as const,
  visit: (id: string) => ["visit", id] as const,
  alert: (id: string) => ["alert", id] as const,
};

export function useInbox(kind: InboxKind) {
  return useQuery({
    queryKey: keys.inbox(kind),
    queryFn: () => inboxApi.list(kind),
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

/** Invalidate every inbox slice + the affected detail after a write. */
function useInvalidate() {
  const qc = useQueryClient();
  return (detailKey?: readonly unknown[]) => {
    void qc.invalidateQueries({ queryKey: ["inbox"] });
    if (detailKey) void qc.invalidateQueries({ queryKey: detailKey });
  };
}

export function useCancelVisit(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => visitsApi.cancel(id),
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
