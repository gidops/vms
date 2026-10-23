"use client";

import { PERMISSIONS } from "@vms/contracts";
import {
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
import { useTranslations } from "next-intl";
import * as React from "react";
import { StatusCell } from "@/app/[locale]/_components/StatusCell";
import {
  StaffRangeFilter,
  type StaffRange,
} from "@/app/[locale]/staff/_components/StaffRangeFilter";
import {
  MyVisitsRangeFilter,
  type DateRange,
  type MyVisitsTab,
} from "@/app/[locale]/staff/visits/_components/MyVisitsRangeFilter";
import {
  dayWindow,
  useAdminVisits,
  type AdminVisitsParams,
} from "@/data/admin/queries";
import type { VisitListItem } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { VisitorCell } from "./VisitorCell";

/** Statuses an approver acts on — the row action becomes "Review". */
export const NEEDS_DECISION = ["PENDING", "REVIEW_REQUESTED", "FLAGGED"];

export interface AdminVisitsTableProps {
  /**
   * `vmc` — VMC records columns (Guest, Channel, Host/Unit, Purpose, Guests,
   * Status, Action), striped rows with an action button.
   * `staff` — staff schedule columns (Guest, Purpose, Guests, Status); the
   * whole row opens the detail sheet.
   */
  columns?: "vmc" | "staff";
  /**
   * `myVisits` — staff My Visits header strip with Today / Upcoming /
   * Yesterday / Pick date pills (this is where the old "Upcoming" card
   * lives), soonest first. Both windows filter on the scheduled date.
   * `staff` — staff dashboard toolbar with Today / Last 7 days / Custom
   * (latest first).
   */
  range?: "myVisits" | "staff";
  /** Debounced search + facets from the filter bar. */
  query: Pick<AdminVisitsParams, "search" | "status" | "type" | "purpose">;
  onOpen: (row: VisitListItem) => void;
  pageSize?: number;
}

/** The admin visits table, built from the VMC and staff record tables. */
export function AdminVisitsTable({
  columns = "vmc",
  range = "myVisits",
  query,
  onOpen,
  pageSize = 8,
}: AdminVisitsTableProps) {
  const t = useTranslations("adminV2.table");
  const tDash = useTranslations("dashboard");
  const { hasPermission } = useAuth();
  const canApprove = hasPermission(PERMISSIONS.VISIT_APPROVE);

  const [tab, setTab] = React.useState<MyVisitsTab>("today");
  const [staffRange, setStaffRange] = React.useState<StaffRange>("today");
  const [dateWindow, setDateWindow] = React.useState<DateRange>(() =>
    dayWindow(0),
  );
  const [page, setPage] = React.useState(1);

  // Search spans everything in scope (staff behaviour): drop the window.
  const searching = !!query.search;
  const queryKey = JSON.stringify(query);
  const [lastKey, setLastKey] = React.useState(queryKey);
  if (lastKey !== queryKey) {
    setLastKey(queryKey);
    setPage(1);
  }

  const visits = useAdminVisits({
    ...query,
    ...(searching ? {} : dateWindow),
    dateField: "scheduledAt",
    sortBy: "scheduledAt",
    sortDir: range === "myVisits" ? "asc" : "desc",
    page,
    pageSize,
  });
  const rows = visits.data?.items ?? [];
  const totalPages = visits.data?.totalPages ?? 1;
  const colSpan = columns === "vmc" ? 7 : 4;

  const action = (row: VisitListItem) =>
    canApprove && NEEDS_DECISION.includes(row.status) ? (
      <Button
        intent="primary"
        size="sm"
        className="min-w-28 text-xs"
        onClick={() => onOpen(row)}
      >
        {t("review")}
      </Button>
    ) : (
      <Button
        intent="neutral"
        tone="outline"
        size="sm"
        className="min-w-28 text-xs"
        onClick={() => onOpen(row)}
      >
        {tDash("actions.viewDetails")}
      </Button>
    );

  const guests = (row: VisitListItem) => (
    <span className="flex items-center gap-1.5">
      <CircleUser className="size-4" aria-hidden="true" />
      {tDash("guestCount", { count: row.groupSize })}
    </span>
  );

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{tDash("columns.visitor")}</TableHead>
          {columns === "vmc" ? (
            <>
              <TableHead>{tDash("columns.channel")}</TableHead>
              <TableHead>{tDash("columns.hostUnit")}</TableHead>
            </>
          ) : null}
          <TableHead>{tDash("columns.purpose")}</TableHead>
          <TableHead>{tDash("columns.guestCount")}</TableHead>
          <TableHead>{tDash("columns.status")}</TableHead>
          {columns === "vmc" ? (
            <TableHead>{tDash("columns.action")}</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody striped>
        {visits.isLoading ? (
          <TableRow>
            <TableCell colSpan={colSpan}>
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            </TableCell>
          </TableRow>
        ) : rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={colSpan}
              className="py-10 text-center text-fg-subtle"
            >
              {t("empty")}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow
              key={row.id}
              className={columns === "staff" ? "cursor-pointer" : undefined}
              onClick={columns === "staff" ? () => onOpen(row) : undefined}
            >
              <TableCell>
                <VisitorCell row={row} />
              </TableCell>
              {columns === "vmc" ? (
                <>
                  <TableCell className="text-fg-muted">
                    {row.type === "WALK_IN"
                      ? tDash("channel.walkIn")
                      : tDash("channel.invited")}
                  </TableCell>
                  <TableCell className="text-fg-muted">
                    {row.host?.user.fullName ?? row.floor ?? "—"}
                  </TableCell>
                </>
              ) : null}
              <TableCell className="text-fg-muted">{row.purpose}</TableCell>
              <TableCell className="text-fg-muted">{guests(row)}</TableCell>
              <TableCell>
                <StatusCell
                  status={row.status}
                  scheduledAt={row.scheduledAt}
                  checkInAt={row.checkInAt}
                  checkOutAt={row.checkOutAt}
                  createdAt={row.createdAt}
                />
              </TableCell>
              {columns === "vmc" ? <TableCell>{action(row)}</TableCell> : null}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  const pagination =
    totalPages > 1 ? (
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    ) : undefined;

  if (range === "myVisits") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-stretch justify-between overflow-hidden rounded-xl border-x border-b border-border bg-surface">
          <h2 className="flex items-center px-6 py-4 text-xl font-semibold text-primary">
            {t("title")}
          </h2>
          <MyVisitsRangeFilter
            value={tab}
            onChange={(next, w) => {
              setTab(next);
              setDateWindow(w);
              setPage(1);
            }}
          />
        </div>
        <RecordTable frameless pagination={pagination}>
          {table}
        </RecordTable>
      </div>
    );
  }

  return (
    <RecordTable
      frameless
      pagination={pagination}
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-primary">{t("title")}</h2>
          <StaffRangeFilter
            value={staffRange}
            disabled={searching}
            onChange={(next, w) => {
              setStaffRange(next);
              if (w) setDateWindow(w);
              setPage(1);
            }}
          />
        </div>
      }
    >
      {table}
    </RecordTable>
  );
}
