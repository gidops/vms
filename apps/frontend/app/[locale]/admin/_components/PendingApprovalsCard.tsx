"use client";

import { PERMISSIONS } from "@vms/contracts";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { CircleCheck } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { VisitDetailSheet } from "@/app/[locale]/_components/VisitDetailSheet";
import { GroupApprovalSheet } from "@/app/[locale]/requests/_components/GroupApprovalSheet";
import { usePendingVisits } from "@/data/requests/queries";
import type { VisitListItem } from "@/data/visits/visits.api";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import {
  OVERDUE_MINUTES,
  PENDING_PREVIEW,
  sortOldestFirst,
  waitingMinutes,
} from "./pendingApprovals";

type Decision = { id: string; form: "deny" | null };

/** Quiet one-line slot used for the empty, loading and error states. */
function QuietLine({
  role,
  tone = "muted",
  children,
}: {
  role: "status" | "alert";
  tone?: "muted" | "danger";
  children: React.ReactNode;
}) {
  return (
    <p
      role={role}
      className={
        "flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm " +
        (tone === "danger" ? "text-danger" : "text-fg-muted")
      }
    >
      {children}
    </p>
  );
}

/**
 * Security Manager's approval queue preview, right under the overview bar:
 * oldest request first, the top {@link PENDING_PREVIEW} with their waiting time,
 * and a link to the full queue. Approve/Deny open the visit's side-tray sheet
 * (Deny with its reason form expanded); a group opens the group review sheet.
 * Only rendered for roles that can approve; an empty queue collapses to a
 * one-line "All caught up".
 */
export function PendingApprovalsCard() {
  const t = useTranslations("admin.overview.approvals");
  const tType = useTranslations("requests.typeOption");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { hasPermission } = useAuth();
  const canApprove = hasPermission(PERMISSIONS.VISIT_APPROVE);
  const canDeny = hasPermission(PERMISSIONS.VISIT_DENY);
  const pending = usePendingVisits();
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const [groupId, setGroupId] = React.useState<string | null>(null);

  if (!canApprove) return null;

  const all = sortOldestFirst(pending.data?.items ?? []);
  const rows = all.slice(0, PENDING_PREVIEW);
  const total = pending.data?.total ?? all.length;

  const sheets = (
    <>
      {decision ? (
        <VisitDetailSheet
          kind="request"
          id={decision.id}
          initialForm={decision.form}
          onClose={() => setDecision(null)}
        />
      ) : null}
      {groupId ? (
        <GroupApprovalSheet
          groupId={groupId}
          onClose={() => setGroupId(null)}
        />
      ) : null}
    </>
  );

  // Sheets stay mounted across states so a decision that empties the queue
  // doesn't yank the open sheet away.
  if (pending.isLoading) {
    return (
      <QuietLine role="status">
        <Spinner className="size-4" role="presentation" aria-hidden="true" />
        {t("loading")}
      </QuietLine>
    );
  }
  if (pending.isError) {
    return (
      <QuietLine role="alert" tone="danger">
        {t("loadError")}
      </QuietLine>
    );
  }
  if (rows.length === 0) {
    return (
      <>
        <QuietLine role="status">
          <CircleCheck className="size-4 text-success" aria-hidden="true" />
          {t("allCaughtUp")}
        </QuietLine>
        {sheets}
      </>
    );
  }

  const name = (v: VisitListItem) =>
    v.isGroupVisit && v.groupName ? v.groupName : v.visitor.fullName;
  const subtitle = (v: VisitListItem) =>
    v.isGroupVisit
      ? t("groupGuests", { count: v.groupSize })
      : [
          v.purpose,
          tType.has(v.type as "WALK_IN") ? tType(v.type as "WALK_IN") : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const waiting = (v: VisitListItem) => {
    const mins = waitingMinutes(v.createdAt, now);
    return (
      <Badge
        intent={mins >= OVERDUE_MINUTES ? "danger" : "warning"}
        tone="soft"
        className="font-semibold"
      >
        {mins >= 60
          ? t("waitingHours", {
              hours: Math.floor(mins / 60),
              minutes: mins % 60,
            })
          : t("waitingMinutes", { minutes: mins })}
      </Badge>
    );
  };

  return (
    <Card
      role="region"
      aria-labelledby="admin-pending-approvals"
      className="flex flex-col overflow-hidden rounded-2xl border-2 border-warning"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            id="admin-pending-approvals"
            className="text-lg font-semibold text-fg"
          >
            {t("title")}
          </h2>
          <Badge intent="warning" tone="soft" className="font-semibold">
            {t("waitingCount", { count: total })}
          </Badge>
          <span className="text-sm text-fg-muted">{t("oldestFirst")}</span>
        </div>
        <Link
          href="/admin/requests"
          className="rounded text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          {t("openQueue")}
        </Link>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.visitor")}</TableHead>
              <TableHead className="hidden md:table-cell">
                {t("columns.host")}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t("columns.time")}
              </TableHead>
              <TableHead>{t("columns.waiting")}</TableHead>
              <TableHead className="text-end">
                {t("columns.decision")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((v) => (
              <TableRow key={v.id} data-testid="pending-approval-row">
                <TableCell>
                  <span className="flex items-center gap-3">
                    <Avatar
                      name={name(v)}
                      size="md"
                      accent={v.isGroupVisit ? "group" : "single"}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold text-fg">{name(v)}</span>
                      <span className="text-xs text-fg-muted">
                        {subtitle(v)}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="hidden text-fg-muted md:table-cell">
                  {v.host?.user.fullName ?? v.floor ?? "—"}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-fg-muted md:table-cell">
                  {v.scheduledAt
                    ? format.dateTime(new Date(v.scheduledAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </TableCell>
                <TableCell>{waiting(v)}</TableCell>
                <TableCell>
                  <span className="flex justify-end gap-2">
                    {v.isGroupVisit && v.groupId ? (
                      <Button
                        size="sm"
                        intent="neutral"
                        tone="outline"
                        onClick={() => setGroupId(v.groupId!)}
                        aria-label={t("reviewGroupFor", { name: name(v) })}
                      >
                        {t("reviewGroup")}
                      </Button>
                    ) : (
                      <>
                        {canDeny ? (
                          <Button
                            size="sm"
                            intent="danger"
                            tone="outline"
                            onClick={() =>
                              setDecision({ id: v.id, form: "deny" })
                            }
                            aria-label={t("denyFor", { name: name(v) })}
                          >
                            {t("deny")}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          intent="primary"
                          onClick={() => setDecision({ id: v.id, form: null })}
                          aria-label={t("approveFor", { name: name(v) })}
                        >
                          {t("approve")}
                        </Button>
                      </>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm sm:px-5">
        <span className="text-fg-muted">
          {t("showing", { shown: rows.length, total })}
        </span>
        <Link
          href="/admin/requests"
          className="rounded font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          {t("seeAll", { total })}
        </Link>
      </div>
      {sheets}
    </Card>
  );
}
