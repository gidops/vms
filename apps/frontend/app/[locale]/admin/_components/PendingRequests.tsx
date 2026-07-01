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
                  onClick={() => setSelected({ kind: "request", id: v.id })}
                  className="flex w-full items-center gap-3 rounded-md py-3 text-start hover:bg-surface-muted"
                >
                  <Avatar name={v.visitor.fullName} size="sm" />
                  <span className="flex flex-col">
                    <span className="font-medium text-fg">
                      {v.visitor.fullName}
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
    </Card>
  );
}
