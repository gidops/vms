"use client";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Pagination,
  SearchInput,
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
import { CircleUserRound } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import type { VisitListItem } from "@/data/visits/visits.api";
import { useTodaysVisitors } from "@/data/admin/queries";

const COLUMNS = 6;

/** Today's scheduled visits; flagged rows are highlighted and lead to review. */
export function TodaysVisitorsCard({
  search,
  onSearchChange,
  onView,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onView: (visitId: string) => void;
  className?: string;
}) {
  const t = useTranslations("admin.overview.visitors");
  const format = useFormatter();
  const [page, setPage] = React.useState(1);
  const [previousSearch, setPreviousSearch] = React.useState(search);
  if (search !== previousSearch) {
    setPreviousSearch(search);
    setPage(1);
  }
  const visitors = useTodaysVisitors(search, page);
  const rows = visitors.data?.items ?? [];

  const displayName = (row: VisitListItem) =>
    row.isGroupVisit && row.groupName ? row.groupName : row.visitor.fullName;

  return (
    <Card
      role="region"
      aria-labelledby="admin-todays-visitors"
      className={cn("flex flex-col overflow-hidden rounded-2xl", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h2
          id="admin-todays-visitors"
          className="flex items-center gap-2 text-lg font-semibold text-fg"
        >
          {t("title")}
          {visitors.data ? (
            <Badge intent="primary" tone="soft">
              {format.number(visitors.data.total)}
            </Badge>
          ) : null}
        </h2>
        <div className="w-full sm:w-64">
          <SearchInput
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onClear={() => onSearchChange("")}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="rounded-full"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.visitor")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.host")}</TableHead>
              <TableHead>{t("columns.guests")}</TableHead>
              <TableHead>{t("columns.time")}</TableHead>
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
                  {search ? t("noMatches") : t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const flagged = row.status === "FLAGGED";
                const name = displayName(row);
                return (
                  <TableRow
                    key={row.id}
                    className={flagged ? "bg-accent-subtle" : undefined}
                  >
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <Avatar
                          name={name}
                          size="md"
                          accent={row.isGroupVisit ? "group" : "single"}
                        />
                        <span className="font-medium text-fg">{name}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {row.host?.user.fullName ?? row.floor ?? "—"}
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      <span className="flex items-center gap-1.5">
                        <CircleUserRound
                          className="size-4 text-fg"
                          aria-hidden="true"
                        />
                        {t("guestCount", { count: row.groupSize })}
                      </span>
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
      {visitors.data && visitors.data.totalPages > 1 ? (
        <div className="flex justify-center border-t border-border p-4">
          <Pagination
            page={page}
            totalPages={visitors.data.totalPages}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </Card>
  );
}
