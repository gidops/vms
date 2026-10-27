"use client";

import { PERMISSIONS, type VisitStatus } from "@vms/contracts";
import {
  Badge,
  Button,
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
import { useLocale, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { FilterPills } from "@/app/[locale]/_components/FilterPills";
import { StatusCell } from "@/app/[locale]/_components/StatusCell";
import { useAdminVisits, type AdminVisitsParams } from "@/data/admin/queries";
import type { VisitListItem } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";
import {
  OVERDUE_MINUTES,
  waitingMinutes,
} from "@/app/[locale]/admin/_components/pendingApprovals";
import { VisitorCell } from "./VisitorCell";

type Bucket = "all" | "REVIEW_REQUESTED" | "FLAGGED" | "group";
const BUCKETS: Bucket[] = ["all", "REVIEW_REQUESTED", "FLAGGED", "group"];
const DECISION_STATUSES: VisitStatus[] = [
  "PENDING",
  "REVIEW_REQUESTED",
  "FLAGGED",
];

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

/** Every option opens the visit sheet: Review where a decision waits, View while it's back with the host. */
function ReviewButton({
  row,
  onOpen,
}: {
  row: VisitListItem;
  onOpen: (row: VisitListItem) => void;
}) {
  const t = useTranslations("adminV2.approvals");
  const withHost = row.status === "REVIEW_REQUESTED";
  return (
    <Button
      intent="neutral"
      tone="outline"
      size="sm"
      className="text-xs"
      onClick={() => onOpen(row)}
      aria-label={t(withHost ? "viewFor" : "reviewFor", { name: nameOf(row) })}
    >
      {withHost ? t("view") : t("review")}
    </Button>
  );
}

/** Approve / Deny when decidable now; groups and everything else fall back to Review. */
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

/** Approval queue, oldest first; Deny opens the visit sheet with its reason form expanded. */
export function PendingApprovalsTable({
  query,
  onOpen,
  onDeny,
  variant = "page",
  actions = variant === "vmc" ? "review" : "decide",
}: {
  query: Pick<AdminVisitsParams, "search" | "type" | "purpose">;
  onOpen: (row: VisitListItem) => void;
  onDeny?: (row: VisitListItem) => void;
  variant?: "page" | "vmc";
  /** Defaults to `review` for `vmc` and `decide` for `page`. */
  actions?: "review" | "decide";
}) {
  const t = useTranslations("adminV2.approvals");
  const tCard = useTranslations("admin.overview.approvals");
  const now = useNow({ updateInterval: 60_000 });
  const locale = useLocale();
  const { hasPermission } = useAuth();
  const canApprove = hasPermission(PERMISSIONS.VISIT_APPROVE);
  const canDeny = hasPermission(PERMISSIONS.VISIT_DENY);
  const tDash = useTranslations("dashboard");
  const tStaff = useTranslations("staff");
  const [bucket, setBucket] = React.useState<Bucket>("all");
  const [page, setPage] = React.useState(1);

  const visits = useAdminVisits({
    ...query,
    ...(bucket === "all" || bucket === "group"
      ? { statuses: DECISION_STATUSES, groupVisit: bucket === "group" }
      : { status: bucket }),
    sortBy: "createdAt",
    sortDir: "asc",
    page,
    pageSize: 10,
  });
  const rows = visits.data?.items ?? [];
  const totalPages = visits.data?.totalPages ?? 1;

  const compact = variant === "vmc";
  const showWaiting = !compact;
  const nf = new Intl.NumberFormat(locale);
  const columns = showWaiting ? 7 : 6;

  const pills = (
    <FilterPills<Bucket>
      aria-label={t("title")}
      value={bucket}
      onValueChange={(b) => {
        setBucket(b);
        setPage(1);
      }}
      options={BUCKETS.map((b) => ({ value: b, label: t(`bucket.${b}`) }))}
    />
  );

  const pagination =
    totalPages > 1 ? (
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    ) : undefined;

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{tDash("columns.visitor")}</TableHead>
          <TableHead>
            {compact ? t("columns.hostFloor") : tDash("columns.hostUnit")}
          </TableHead>
          <TableHead>{tDash("columns.purpose")}</TableHead>
          <TableHead>{tDash("columns.guestCount")}</TableHead>
          <TableHead>{tDash("columns.status")}</TableHead>
          {showWaiting ? (
            <TableHead>{tCard("columns.waiting")}</TableHead>
          ) : null}
          <TableHead>{tDash("columns.action")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody striped>
        {visits.isLoading ? (
          <TableRow>
            <TableCell colSpan={columns}>
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            </TableCell>
          </TableRow>
        ) : rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns}
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
                {showWaiting ? (
                  <span className="flex items-center gap-1.5">
                    <CircleUser className="size-4" aria-hidden="true" />
                    {tDash("guestCount", { count: row.groupSize })}
                  </span>
                ) : (
                  nf.format(row.groupSize)
                )}
              </TableCell>
              <TableCell>
                <StatusCell
                  status={row.status}
                  scheduledAt={row.scheduledAt}
                  createdAt={row.createdAt}
                />
              </TableCell>
              {showWaiting ? (
                <TableCell>
                  <Waiting row={row} now={now} />
                </TableCell>
              ) : null}
              <TableCell>
                {actions === "review" ? (
                  <ReviewButton row={row} onOpen={onOpen} />
                ) : (
                  <RowActions
                    row={row}
                    canApprove={canApprove}
                    canDeny={canDeny && !!onDeny}
                    onOpen={onOpen}
                    onDeny={(r) => onDeny?.(r)}
                    reviewLabel={t("review")}
                    updateLabel={tStaff("actions.update")}
                  />
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  if (variant === "vmc") {
    return (
      <RecordTable
        frameless
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-primary">{t("title")}</h2>
            {pills}
          </div>
        }
        pagination={pagination}
      >
        {table}
      </RecordTable>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-stretch justify-between overflow-hidden rounded-xl border-x border-b border-border bg-surface">
        <h1 className="flex items-center px-6 py-4 text-3xl font-semibold text-fg">
          {t("title")}
        </h1>
        <div className="flex items-center bg-primary-subtle px-6 py-3">
          {pills}
        </div>
      </div>
      <RecordTable frameless pagination={pagination}>
        {table}
      </RecordTable>
    </div>
  );
}
