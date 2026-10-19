"use client";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Pagination,
  SegmentedControl,
  Spinner,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@vms/ui";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import type { VisitStatus } from "@vms/contracts";
import type { VisitListItem } from "@/data/visits/visits.api";
import { useTodaysVisitors } from "@/data/admin/queries";
import { waitingMinutes } from "./pendingApprovals";

const COLUMNS = 5;
const PAGE_SIZE = 5;

/** Overview segments → the visit statuses they show ("all" = no filter). */
export const VISITOR_FILTERS = {
  all: undefined,
  onsite: ["CHECKED_IN"],
  expected: ["APPROVED"],
  out: ["CHECKED_OUT"],
} as const satisfies Record<string, readonly VisitStatus[] | undefined>;
export type VisitorFilter = keyof typeof VISITOR_FILTERS;

/**
 * Today's visitors, earliest first, with an All / Onsite / Expected / Out
 * filter. Onsite rows show how long the visitor has been in, and the time
 * column is the check-in time once they have arrived. Search comes from the
 * top-nav field. Flagged rows are highlighted and lead to review. The card does
 * not render at all when nobody is scheduled today.
 */
export function TodaysVisitorsCard({
  search,
  onView,
  className,
}: {
  search: string;
  onView: (visitId: string) => void;
  className?: string;
}) {
  const t = useTranslations("admin.overview.visitors");
  const tApprovals = useTranslations("admin.overview.approvals");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [page, setPage] = React.useState(1);
  const [filter, setFilter] = React.useState<VisitorFilter>("all");
  const [previousSearch, setPreviousSearch] = React.useState(search);
  if (search !== previousSearch) {
    setPreviousSearch(search);
    setPage(1);
  }
  const statuses = VISITOR_FILTERS[filter];
  const visitors = useTodaysVisitors(
    search,
    page,
    PAGE_SIZE,
    statuses ? [...statuses] : undefined,
  );
  const rows = visitors.data?.items ?? [];
  const total = visitors.data?.total ?? 0;

  if (visitors.isSuccess && total === 0 && filter === "all" && !search) {
    return null;
  }

  const displayName = (row: VisitListItem) =>
    row.isGroupVisit && row.groupName ? row.groupName : row.visitor.fullName;

  const status = (row: VisitListItem) => {
    if (row.status === "CHECKED_IN" && row.checkInAt) {
      const mins = waitingMinutes(String(row.checkInAt), now);
      const duration =
        mins >= 60
          ? tApprovals("waitingHours", {
              hours: Math.floor(mins / 60),
              minutes: mins % 60,
            })
          : tApprovals("waitingMinutes", { minutes: mins });
      return (
        <Badge intent="success" tone="soft" className="font-semibold">
          {t("onsiteFor", { duration })}
        </Badge>
      );
    }
    return <StatusBadge status={row.status} />;
  };

  const time = (row: VisitListItem) => {
    const at = row.checkInAt ?? row.scheduledAt;
    return at ? format.dateTime(new Date(at), { timeStyle: "short" }) : "—";
  };

  const first = (page - 1) * PAGE_SIZE + 1;

  return (
    <Card
      role="region"
      aria-labelledby="admin-todays-visitors"
      className={cn("flex flex-col overflow-hidden rounded-2xl", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
        <h2
          id="admin-todays-visitors"
          className="text-lg font-semibold text-fg"
        >
          {t("title")}
        </h2>
        <SegmentedControl
          aria-label={t("filterLabel")}
          value={filter}
          onValueChange={(v) => {
            setFilter(v as VisitorFilter);
            setPage(1);
          }}
          options={(Object.keys(VISITOR_FILTERS) as VisitorFilter[]).map(
            (key) => ({ value: key, label: t(`filters.${key}`) }),
          )}
        />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.visitor")}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("columns.host")}
              </TableHead>
              <TableHead>{t("columns.time")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("columns.action")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visitors.isLoading ? (
              <TableRow>
                <TableCell colSpan={COLUMNS}>
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                </TableCell>
              </TableRow>
            ) : visitors.isError ? (
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
                  className="py-10 text-center text-fg-muted"
                >
                  {search ? t("noMatches") : t("emptyFilter")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const flagged = row.status === "FLAGGED";
                const name = displayName(row);
                return (
                  <TableRow
                    key={row.id}
                    data-testid="todays-visitor-row"
                    className={flagged ? "bg-accent-subtle" : undefined}
                  >
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <Avatar
                          name={name}
                          size="md"
                          accent={row.isGroupVisit ? "group" : "single"}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold text-fg">{name}</span>
                          {row.isGroupVisit ? (
                            <span className="text-xs text-fg-muted">
                              {tApprovals("groupGuests", {
                                count: row.groupSize,
                              })}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-fg-muted sm:table-cell">
                      {row.host?.user.fullName ?? row.floor ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-fg-muted">
                      {time(row)}
                    </TableCell>
                    <TableCell>{status(row)}</TableCell>
                    <TableCell className="text-end">
                      <Button
                        size="sm"
                        intent="primary"
                        tone={flagged ? "solid" : "ghost"}
                        onClick={() => onView(row.id)}
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
      {visitors.data && total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm sm:px-5">
          <span className="text-fg-muted">
            {t("range", {
              from: first,
              to: first + rows.length - 1,
              total,
            })}
          </span>
          {visitors.data.totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={visitors.data.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
