"use client";

import {
  Button,
  Pagination,
  RecordTable,
  Spinner,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import type { VisitStatus } from "@vms/contracts";
import { CircleUser } from "lucide-react";
import {
  FilterPills,
  SCROLLING_PILLS,
} from "@/app/[locale]/_components/FilterPills";
import { RecordCard } from "@/app/[locale]/_components/RecordCard";
import {
  dayWindow,
  useAdminVisits,
  type AdminVisitsParams,
} from "@/data/admin/queries";
import type { VisitListItem } from "@/data/visits/visits.api";
import { VisitorCell } from "./VisitorCell";

const COLUMNS = 6;

const nameOf = (v: VisitListItem) =>
  v.isGroupVisit && v.groupName ? v.groupName : v.visitor.fullName;

/** Filter pills → the visit statuses they show ("all" = no filter). */
export const VISITOR_FILTERS = {
  all: undefined,
  onsite: ["CHECKED_IN"],
  expected: ["APPROVED"],
  out: ["CHECKED_OUT"],
} as const satisfies Record<string, readonly VisitStatus[] | undefined>;
export type VisitorFilter = keyof typeof VISITOR_FILTERS;

/** Today's scheduled visits (v1 columns and segments) in the VMC records-table style. */
export function TodaysVisitorsTable({
  query,
  onOpen,
  pageSize = 10,
}: {
  query: Pick<AdminVisitsParams, "search" | "status" | "type" | "purpose">;
  onOpen: (row: VisitListItem) => void;
  pageSize?: number;
}) {
  const t = useTranslations("admin.overview.visitors");
  const tDash = useTranslations("dashboard");
  const tStaff = useTranslations("staff");
  const format = useFormatter();
  const [filter, setFilter] = React.useState<VisitorFilter>("all");
  const [page, setPage] = React.useState(1);

  const queryKey = JSON.stringify(query);
  const [lastKey, setLastKey] = React.useState(queryKey);
  if (lastKey !== queryKey) {
    setLastKey(queryKey);
    setPage(1);
  }

  const statuses = VISITOR_FILTERS[filter];
  const visits = useAdminVisits({
    ...query,
    ...dayWindow(0),
    statuses: statuses ? [...statuses] : undefined,
    dateField: "scheduledAt",
    sortBy: "scheduledAt",
    sortDir: "asc",
    page,
    pageSize,
  });
  const rows = visits.data?.items ?? [];

  return (
    <RecordTable
      frameless
      toolbar={
        // Small screens stack the pills under the title on one row that scrolls sideways.
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <h2 className="text-xl font-semibold text-primary">{t("title")}</h2>
          <FilterPills
            aria-label={t("filterLabel")}
            className={SCROLLING_PILLS}
            value={filter}
            onValueChange={(next) => {
              setFilter(next);
              setPage(1);
            }}
            options={(Object.keys(VISITOR_FILTERS) as VisitorFilter[]).map(
              (key) => ({ value: key, label: t(`filters.${key}`) }),
            )}
          />
        </div>
      }
      pagination={
        <Pagination
          page={page}
          totalPages={visits.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      }
    >
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.visitor")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.host")}</TableHead>
              <TableHead>{t("columns.guests")}</TableHead>
              <TableHead>{t("columns.time")}</TableHead>
              <TableHead>{t("columns.action")}</TableHead>
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
            ) : visits.isError ? (
              <TableRow>
                <TableCell colSpan={COLUMNS}>
                  <p role="alert" className="py-10 text-center text-danger">
                    {t("loadError")}
                  </p>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMNS}
                  className="py-10 text-center text-fg-subtle"
                >
                  {query.search ? t("noMatches") : t("emptyFilter")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const flagged = row.status === "FLAGGED";
                const name =
                  row.isGroupVisit && row.groupName
                    ? row.groupName
                    : row.visitor.fullName;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <VisitorCell row={row} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {row.host?.user.fullName ?? row.floor ?? "—"}
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {format.number(row.groupSize)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-fg-muted">
                      {row.scheduledAt
                        ? format.dateTime(new Date(row.scheduledAt), {
                            timeStyle: "short",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        intent={flagged ? "primary" : "neutral"}
                        tone={flagged ? "solid" : "outline"}
                        className="min-w-28 text-xs"
                        onClick={() => onOpen(row)}
                        aria-label={t("viewVisitor", { name })}
                      >
                        {t("view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Small screens: each visit as a tappable card. */}
      <div className="flex flex-col gap-4 md:hidden">
        {visits.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : visits.isError ? (
          <p role="alert" className="py-10 text-center text-danger">
            {t("loadError")}
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-fg-subtle">
            {query.search ? t("noMatches") : t("emptyFilter")}
          </p>
        ) : (
          rows.map((row) => {
            const name = nameOf(row);
            const open = () => onOpen(row);
            return (
              <RecordCard
                key={row.id}
                eyebrow={row.purpose}
                title={name}
                subtitle={
                  row.isGroupVisit
                    ? (row.groupContact ?? undefined)
                    : row.visitor.email
                }
                extra={
                  <span className="text-sm text-fg-muted">
                    {[
                      row.host?.user.fullName ?? row.floor,
                      row.scheduledAt
                        ? format.dateTime(new Date(row.scheduledAt), {
                            timeStyle: "short",
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                }
                status={<StatusBadge status={row.status} />}
                footer={
                  <span className="flex items-center gap-1.5">
                    <CircleUser className="size-4" aria-hidden="true" />
                    {tDash("guestCount", { count: row.groupSize })}
                  </span>
                }
                action={
                  <Button
                    size="sm"
                    intent={row.status === "FLAGGED" ? "primary" : "neutral"}
                    tone={row.status === "FLAGGED" ? "solid" : "outline"}
                    className="min-w-28 text-xs"
                    onClick={open}
                    aria-label={t("viewVisitor", { name })}
                  >
                    {t("view")}
                  </Button>
                }
                onOpen={open}
                openLabel={tStaff("card.openFor", { name })}
              />
            );
          })
        )}
      </div>
    </RecordTable>
  );
}
