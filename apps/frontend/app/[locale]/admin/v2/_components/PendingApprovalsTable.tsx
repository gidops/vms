"use client";

import type { VisitStatus } from "@vms/contracts";
import {
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
import { useTranslations } from "next-intl";
import * as React from "react";
import { StatusCell } from "@/app/[locale]/_components/StatusCell";
import { useAdminVisits, type AdminVisitsParams } from "@/data/admin/queries";
import type { VisitListItem } from "@/data/visits/visits.api";
import { VisitorCell } from "./VisitorCell";

type Bucket = "all" | VisitStatus;
const BUCKETS: Bucket[] = ["all", "PENDING", "REVIEW_REQUESTED", "FLAGGED"];
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

/**
 * Approval queue in the staff "My Visits" layout (header strip with status
 * pills, record table with an action column) — the alternative to the VMC
 * Requests & Alerts card grid. Replaces the admin `PendingRequests` list.
 */
export function PendingApprovalsTable({
  query,
  onOpen,
}: {
  query: Pick<AdminVisitsParams, "search" | "type" | "purpose">;
  onOpen: (row: VisitListItem) => void;
}) {
  const t = useTranslations("adminV2.approvals");
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
              <TableHead>{tDash("columns.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody striped>
            {visits.isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
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
                    {row.status === "REVIEW_REQUESTED" ? (
                      <Button
                        intent="danger"
                        size="sm"
                        className="min-w-28 text-xs"
                        onClick={() => onOpen(row)}
                      >
                        {tStaff("actions.update")}
                      </Button>
                    ) : (
                      <Button
                        intent="primary"
                        size="sm"
                        className="min-w-28 text-xs"
                        onClick={() => onOpen(row)}
                      >
                        {t("review")}
                      </Button>
                    )}
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
