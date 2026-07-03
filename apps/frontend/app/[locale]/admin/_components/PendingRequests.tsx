"use client";

import {
  Avatar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
} from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { GroupApprovalSheet } from "@/app/[locale]/requests/_components/GroupApprovalSheet";
import {
  RequestDrawer,
  type SelectedItem,
} from "@/app/[locale]/requests/_components/RequestDrawer";
import { usePendingVisits } from "@/data/requests/queries";

/**
 * Admin approval queue: pending visit requests; clicking one opens the shared
 * request drawer where admins approve/deny. Refreshes after a decision.
 */
export function PendingRequests() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const pending = usePendingVisits();
  const [selected, setSelected] = React.useState<SelectedItem | null>(null);
  const [groupApproval, setGroupApproval] = React.useState<string | null>(null);
  const items = pending.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("pendingTitle")}
          {items.length > 0 ? ` (${items.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-fg-muted">{t("pendingBody")}</p>
        {pending.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="py-4 text-sm text-fg-subtle">{t("pendingEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() =>
                    v.isGroupVisit && v.groupId
                      ? setGroupApproval(v.groupId)
                      : setSelected({ kind: "request", id: v.id })
                  }
                  className="flex w-full items-center gap-3 rounded-md py-3 text-start hover:bg-surface-muted"
                >
                  <Avatar
                    name={
                      v.isGroupVisit && v.groupName
                        ? v.groupName
                        : v.visitor.fullName
                    }
                    size="sm"
                    accent={v.isGroupVisit ? "group" : undefined}
                  />
                  <span className="flex flex-col">
                    <span className="font-medium text-fg">
                      {v.isGroupVisit && v.groupName
                        ? t("groupLabel", {
                            name: v.groupName,
                            count: v.groupSize,
                          })
                        : v.visitor.fullName}
                    </span>
                    <span className="text-xs text-fg-muted">
                      {v.purpose}
                      {v.host ? ` · ${v.host.user.fullName}` : ""}
                      {v.scheduledAt
                        ? ` · ${format.dateTime(new Date(v.scheduledAt), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}`
                        : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <RequestDrawer selected={selected} onClose={() => setSelected(null)} />
      {groupApproval ? (
        <GroupApprovalSheet
          groupId={groupApproval}
          onClose={() => setGroupApproval(null)}
        />
      ) : null}
    </Card>
  );
}
