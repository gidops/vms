"use client";

import {
  Button,
  Checkbox,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  Spinner,
  StatusBadge,
  Textarea,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import {
  useBulkApproveVisits,
  useBulkDenyVisits,
  useVisitGroup,
} from "@/data/requests/queries";
import type { VisitListItem } from "@/data/visits/visits.api";

/** A pending/needs-info guest is the only one an admin can still approve or deny. */
const isActionable = (g: VisitListItem) =>
  g.status === "PENDING" || g.status === "NEEDS_MORE_INFO";

/**
 * Group approval sheet — mirrors the group check-in sheet for the admin approval
 * queue. Lists a group invite's guests with per-guest Approve/Reject, multi-select
 * "Approve Selected" / "Reject Selected", and "Approve All". Rejection needs a
 * shared reason. Backed by the bulk approve/deny endpoint.
 */
export function GroupApprovalSheet({
  groupId,
  onClose,
}: {
  groupId: string;
  onClose: () => void;
}) {
  const t = useTranslations("approval");
  const groupQ = useVisitGroup(groupId);
  const approve = useBulkApproveVisits();
  const deny = useBulkDenyVisits();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [reason, setReason] = React.useState("");

  const guests = groupQ.data?.items ?? [];
  const approved = guests.filter((g) => g.status === "APPROVED").length;
  const pending = guests.filter(isActionable);
  const busy = approve.isPending || deny.isPending;
  const reasonValid = reason.trim().length > 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedPending = pending
    .filter((g) => selected.has(g.id))
    .map((g) => g.id);

  const doApprove = (ids: string[]) => {
    if (ids.length)
      approve.mutate(ids, { onSuccess: () => setSelected(new Set()) });
  };
  const doDeny = (ids: string[]) => {
    if (ids.length && reasonValid)
      deny.mutate(
        { visitIds: ids, reason: reason.trim() },
        { onSuccess: () => setSelected(new Set()) },
      );
  };

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent side="start" className="flex max-w-xl flex-col gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border p-5 pe-12">
          <DrawerTitle className="text-xl font-semibold text-fg">
            {t("groupTitle")}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {t("guestInformation")}
          </DrawerDescription>
        </div>

        <div className="flex items-center justify-between px-5 py-3 text-sm">
          <span className="font-semibold text-primary">
            {t("guestInformation")}
          </span>
          <span className="text-fg-muted">
            {t("approvedCount", { done: approved, total: guests.length })}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groupQ.isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            guests.map((g) => {
              const actionable = isActionable(g);
              return (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    {actionable ? (
                      <Checkbox
                        className="mt-1"
                        checked={selected.has(g.id)}
                        onCheckedChange={() => toggle(g.id)}
                        aria-label={t("select")}
                      />
                    ) : (
                      <span className="w-4" />
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-fg">
                        {g.visitor.fullName}
                      </span>
                      <span className="text-xs text-fg-muted">
                        {g.visitor.email}
                        {g.visitor.phone ? ` · ${g.visitor.phone}` : ""}
                      </span>
                      <StatusBadge status={g.status} />
                    </div>
                  </div>
                  {actionable ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        intent="success"
                        size="sm"
                        disabled={busy}
                        onClick={() => doApprove([g.id])}
                      >
                        {t("approve")}
                      </Button>
                      <Button
                        intent="danger"
                        tone="outline"
                        size="sm"
                        disabled={busy || !reasonValid}
                        onClick={() => doDeny([g.id])}
                      >
                        {t("reject")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border p-4">
          <Textarea
            value={reason}
            placeholder={t("reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              intent="neutral"
              tone="outline"
              size="sm"
              disabled={busy || selectedPending.length === 0}
              onClick={() => doApprove(selectedPending)}
            >
              {t("approveSelected", { count: selectedPending.length })}
            </Button>
            <Button
              intent="danger"
              tone="outline"
              size="sm"
              disabled={busy || selectedPending.length === 0 || !reasonValid}
              onClick={() => doDeny(selectedPending)}
            >
              {t("rejectSelected", { count: selectedPending.length })}
            </Button>
            <Button
              intent="primary"
              className="ms-auto"
              disabled={busy || pending.length === 0}
              onClick={() => doApprove(pending.map((g) => g.id))}
            >
              {t("approveAll")}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
