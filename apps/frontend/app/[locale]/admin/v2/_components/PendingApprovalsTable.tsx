"use client";

import { PERMISSIONS, type VisitStatus } from "@vms/contracts";
import {
  Badge,
  Button,
  cn,
  Pagination,
  RecordTable,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { CircleUser } from "lucide-react";
import { useNow, useTranslations } from "next-intl";
import * as React from "react";
import { StatusCell } from "@/app/[locale]/_components/StatusCell";
import { useAdminVisits, type AdminVisitsParams } from "@/data/admin/queries";
import type { VisitListItem } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";
import {
  OVERDUE_MINUTES,
  waitingMinutes,
} from "@/app/[locale]/admin/_components/pendingApprovals";
import { VisitorCell } from "./VisitorCell";

type Bucket = "all" | VisitStatus;
const BUCKETS: Bucket[] = ["all", "PENDING", "REVIEW_REQUESTED", "FLAGGED"];
const COLUMNS = 7;
const DECISION_STATUSES: VisitStatus[] = [
  "PENDING",
  "REVIEW_REQUESTED",
  "FLAGGED",
];

// Same pill language as the staff My Visits range filter.
const pill =
  "rounded-full border bg-surface px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";
const pillState = (active: boolean) =>
  active
    ? "border-primary text-primary"
    : "border-border text-fg-muted hover:text-fg";

const nameOf = (v: VisitListItem) =>
  v.isGroupVisit && v.groupName ? v.groupName : v.visitor.fullName;

/** How long a request has waited, or "More info asked" while it's with the host. */
function Waiting({ row, now }: { row: VisitListItem; now: Date }) {
  const t = useTranslations("admin.overview.approvals");
  if (row.status === "REVIEW_REQUESTED") {
    return (
      <Badge intent="info" tone="soft">
        {t("moreInfoAsked")}
      </Badge>
    );
  }
  const mins = waitingMinutes(row.createdAt, now);
  return (
    <Badge intent={mins >= OVERDUE_MINUTES ? "danger" : "warning"} tone="soft">
      {mins >= 60
        ? t("waitingHours", {
            hours: Math.floor(mins / 60),
            minutes: mins % 60,
          })
        : t("waitingMinutes", { minutes: mins })}
    </Badge>
  );
}

/**
 * Approve / Deny for a request an approver can decide now; a group opens its
 * group review, and everything else (more info asked, flagged, read-only
 * roles) keeps the single Review / Update button.
 */
function RowActions({
  row,
  canApprove,
  canDeny,
  onOpen,
  onDeny,
  reviewLabel,
  updateLabel,
}: {
  row: VisitListItem;
  canApprove: boolean;
  canDeny: boolean;
  onOpen: (row: VisitListItem) => void;
  onDeny: (row: VisitListItem) => void;
  reviewLabel: string;
  updateLabel: string;
}) {
  const t = useTranslations("admin.overview.approvals");
  const name = nameOf(row);
  if (row.status === "REVIEW_REQUESTED") {
    return (
      <Button
        intent="danger"
        size="sm"
        className="min-w-28 text-xs"
        onClick={() => onOpen(row)}
      >
        {updateLabel}
      </Button>
    );
  }
  if (canApprove && row.isGroupVisit && row.groupId) {
    return (
      <Button
        size="sm"
        className="min-w-28 text-xs"
        onClick={() => onOpen(row)}
        aria-label={t("reviewGroupFor", { name })}
      >
        {t("reviewGroup")}
      </Button>
    );
  }
  if (canApprove && row.status === "PENDING") {
    return (
      <span className="flex items-center gap-2">
        {canDeny ? (
          <Button
            intent="danger"
            tone="outline"
            size="sm"
            className="text-xs"
            onClick={() => onDeny(row)}
            aria-label={t("denyFor", { name })}
          >
            {t("deny")}
          </Button>
        ) : null}
        <Button
          size="sm"
          className="text-xs"
          onClick={() => onOpen(row)}
          aria-label={t("approveFor", { name })}
        >
          {t("approve")}
        </Button>
      </span>
    );
  }
  return (
    <Button size="sm" className="min-w-28 text-xs" onClick={() => onOpen(row)}>
      {reviewLabel}
    </Button>
  );
}

/**
 * Approval queue in the staff "My Visits" layout (header strip with status
 * pills, record table with an action column) — the alternative to the VMC
 * Requests & Alerts card grid. Replaces the admin `PendingRequests` list.
 *
 * From the /admin approvals card: oldest first with how long each request has
 * waited (red past {@link OVERDUE_MINUTES}; "More info asked" while it is back
 * with the host), and Approve / Deny straight from the row for approvers —
 * both open the visit's side tray, Deny with its reason form expanded.
 */
export function PendingApprovalsTable({
  query,
  onOpen,
  onDeny,
}: {
  query: Pick<AdminVisitsParams, "search" | "type" | "purpose">;
  onOpen: (row: VisitListItem) => void;
  onDeny?: (row: VisitListItem) => void;
}) {
  const t = useTranslations("adminV2.approvals");
  const tCard = useTranslations("admin.overview.approvals");
  const now = useNow({ updateInterval: 60_000 });
  const { hasPermission } = useAuth();
  const canApprove = hasPermission(PERMISSIONS.VISIT_APPROVE);
  const canDeny = hasPermission(PERMISSIONS.VISIT_DENY);
  const tDash = useTranslations("dashboard");
  const tStaff = useTranslations("staff");
  const [bucket, setBucket] = React.useState<Bucket>("all");
  const [page, setPage] = React.useState(1);

  const visits = useAdminVisits({
    ...query,
    ...(bucket === "all"
      ? { statuses: DECISION_STATUSES }
      : { status: bucket }),
    sortBy: "createdAt",
    sortDir: "asc",
    page,
    pageSize: 10,
  });
  const rows = visits.data?.items ?? [];
  const totalPages = visits.data?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-stretch justify-between overflow-hidden rounded-xl border-x border-b border-border bg-surface">
        <h1 className="flex items-center px-6 py-4 text-3xl font-semibold text-fg">
          {t("title")}
        </h1>
        <div
          role="radiogroup"
          aria-label={t("title")}
          className="flex items-center gap-2 bg-primary-subtle px-6 py-3"
        >
          {BUCKETS.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={bucket === b}
              onClick={() => {
                setBucket(b);
                setPage(1);
              }}
              className={cn(pill, pillState(bucket === b))}
            >
              {t(`bucket.${b}`)}
            </button>
          ))}
        </div>
      </div>

      <RecordTable
        frameless
        pagination={
          totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : undefined
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tDash("columns.visitor")}</TableHead>
              <TableHead>{tDash("columns.hostUnit")}</TableHead>
              <TableHead>{tDash("columns.purpose")}</TableHead>
              <TableHead>{tDash("columns.guestCount")}</TableHead>
              <TableHead>{tDash("columns.status")}</TableHead>
              <TableHead>{tCard("columns.waiting")}</TableHead>
              <TableHead>{tDash("columns.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody striped>
            {visits.isLoading ? (
              <TableRow>
                <TableCell colSpan={COLUMNS}>
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMNS}
                  className="py-10 text-center text-fg-subtle"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <VisitorCell row={row} />
                  </TableCell>
                  <TableCell className="text-fg-muted">
                    {row.host?.user.fullName ?? row.floor ?? "—"}
                  </TableCell>
                  <TableCell className="text-fg-muted">{row.purpose}</TableCell>
                  <TableCell className="text-fg-muted">
                    <span className="flex items-center gap-1.5">
                      <CircleUser className="size-4" aria-hidden="true" />
                      {tDash("guestCount", { count: row.groupSize })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusCell
                      status={row.status}
                      scheduledAt={row.scheduledAt}
                      createdAt={row.createdAt}
                    />
                  </TableCell>
                  <TableCell>
                    <Waiting row={row} now={now} />
                  </TableCell>
                  <TableCell>
                    <RowActions
                      row={row}
                      canApprove={canApprove}
                      canDeny={canDeny && !!onDeny}
                      onOpen={onOpen}
                      onDeny={(r) => onDeny?.(r)}
                      reviewLabel={t("review")}
                      updateLabel={tStaff("actions.update")}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </RecordTable>
    </div>
  );
}
