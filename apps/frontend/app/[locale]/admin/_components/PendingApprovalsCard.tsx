"use client";

import { PERMISSIONS } from "@vms/contracts";
import {
  Avatar,
  Badge,
  Button,
  Card,
  SegmentedControl,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { ArrowRight } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { VisitDetailSheet } from "@/app/[locale]/_components/VisitDetailSheet";
import { GroupApprovalSheet } from "@/app/[locale]/requests/_components/GroupApprovalSheet";
import { useApprovalQueue } from "@/data/admin/queries";
import type { VisitListItem } from "@/data/visits/visits.api";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import {
  APPROVAL_FILTERS,
  type ApprovalFilter,
  OVERDUE_MINUTES,
  PENDING_PREVIEW,
  matchesApprovalFilter,
  sortOldestFirst,
  waitingMinutes,
} from "./pendingApprovals";

type Decision = { id: string; form: "deny" | null };

const COLUMNS = 5;

const LINK_CLASS =
  "inline-flex items-center gap-1 rounded text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

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

/** Approver-only preview of the oldest requests; hidden when the queue is empty (the bar already says "All caught up"). */
export function PendingApprovalsCard() {
  const t = useTranslations("admin.overview.approvals");
  const tType = useTranslations("requests.typeOption");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { hasPermission } = useAuth();
  const canApprove = hasPermission(PERMISSIONS.VISIT_APPROVE);
  const canDeny = hasPermission(PERMISSIONS.VISIT_DENY);
  const queue = useApprovalQueue();
  const [filter, setFilter] = React.useState<ApprovalFilter>("all");
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const [groupId, setGroupId] = React.useState<string | null>(null);

  if (!canApprove) return null;

  const all = sortOldestFirst(queue.data?.items ?? []);
  const matching = all.filter((v) => matchesApprovalFilter(v, filter));
  const rows = matching.slice(0, PENDING_PREVIEW);
  const total = queue.data?.total ?? all.length;

  // Sheets stay mounted so a decision that empties the queue doesn't yank the open sheet away.
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

  if (queue.isLoading) {
    return (
      <QuietLine role="status">
        <Spinner className="size-4" role="presentation" aria-hidden="true" />
        {t("loading")}
      </QuietLine>
    );
  }
  if (queue.isError) {
    return (
      <QuietLine role="alert" tone="danger">
        {t("loadError")}
      </QuietLine>
    );
  }
  if (all.length === 0) return sheets;

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
  const hostUnit = (v: VisitListItem) =>
    v.host
      ? [v.host.user.fullName, v.host.department].filter(Boolean).join(" · ")
      : (v.floor ?? "—");
  const visitTime = (v: VisitListItem) => {
    if (!v.scheduledAt) return "—";
    const at = new Date(v.scheduledAt);
    const sameDay =
      format.dateTime(at, { dateStyle: "short" }) ===
      format.dateTime(now, { dateStyle: "short" });
    return sameDay
      ? t("todayAt", { time: format.dateTime(at, { timeStyle: "short" }) })
      : format.dateTime(at, { dateStyle: "medium", timeStyle: "short" });
  };

  const waiting = (v: VisitListItem) => {
    if (v.status === "REVIEW_REQUESTED") {
      return (
        <Badge intent="info" tone="soft" className="font-semibold">
          {t("moreInfoAsked")}
        </Badge>
      );
    }
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

  const actions = (v: VisitListItem) => {
    if (v.isGroupVisit && v.groupId) {
      return (
        <Button
          size="sm"
          intent="neutral"
          tone="outline"
          onClick={() => setGroupId(v.groupId!)}
          aria-label={t("reviewGroupFor", { name: name(v) })}
        >
          {t("reviewGroup")}
        </Button>
      );
    }
    if (v.status === "REVIEW_REQUESTED") {
      return (
        <Button
          size="sm"
          intent="neutral"
          tone="outline"
          onClick={() => setDecision({ id: v.id, form: null })}
          aria-label={t("viewFor", { name: name(v) })}
        >
          {t("view")}
        </Button>
      );
    }
    return (
      <>
        {canDeny ? (
          <Button
            size="sm"
            intent="danger"
            tone="outline"
            onClick={() => setDecision({ id: v.id, form: "deny" })}
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
        <div className="flex flex-wrap items-center gap-4">
          <SegmentedControl
            aria-label={t("filterLabel")}
            value={filter}
            onValueChange={(v) => setFilter(v as ApprovalFilter)}
            options={APPROVAL_FILTERS.map((key) => ({
              value: key,
              label: t(`filters.${key}`),
            }))}
          />
          <Link href="/admin/requests" className={LINK_CLASS}>
            {t("openQueue")}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMNS}
                  className="py-8 text-center text-fg-muted"
                >
                  {t("emptyFilter")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((v) => (
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
                    {hostUnit(v)}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-fg-muted md:table-cell">
                    {visitTime(v)}
                  </TableCell>
                  <TableCell>{waiting(v)}</TableCell>
                  <TableCell>
                    <span className="flex justify-end gap-2">{actions(v)}</span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm sm:px-5">
        <span className="text-fg-muted">
          {t("showing", { shown: rows.length, total: matching.length })}
        </span>
        <Link href="/admin/requests" className={LINK_CLASS}>
          {t("seeAll", { total })}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
      {sheets}
    </Card>
  );
}
