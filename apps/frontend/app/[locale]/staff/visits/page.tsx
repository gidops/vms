"use client";

import {
  Avatar,
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
  TopNavShell,
} from "@vms/ui";
import { CircleUser } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { StatusCell } from "@/app/[locale]/_components/StatusCell";
import {
  RequestDrawer,
  type SelectedItem,
} from "@/app/[locale]/requests/_components/RequestDrawer";
import {
  VisitFilters,
  type VisitFiltersValue,
} from "@/app/[locale]/staff/_components/VisitFilters";
import {
  fixedTabBounds,
  MyVisitsRangeFilter,
  type DateRange,
  type MyVisitsTab,
} from "@/app/[locale]/staff/visits/_components/MyVisitsRangeFilter";
import { useMyVisits } from "@/data/requests/queries";
import { RouteGuard } from "@/shared/auth/RouteGuard";

function MyVisits() {
  const t = useTranslations("staff");

  const [tab, setTab] = React.useState<MyVisitsTab>("today");
  const [dates, setDates] = React.useState<DateRange>(() =>
    fixedTabBounds("today"),
  );
  const [filters, setFilters] = React.useState<VisitFiltersValue>({
    search: "",
    status: "all",
    type: "all",
    purpose: "all",
  });
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<SelectedItem | null>(null);

  // Changing any filter or tab resets paging to the first page.
  const onRange = (next: MyVisitsTab, window: DateRange) => {
    setTab(next);
    setDates(window);
    setPage(1);
  };
  const onFilters = (patch: Partial<VisitFiltersValue>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const visits = useMyVisits({
    ...dates,
    status: filters.status === "all" ? undefined : filters.status,
    type: filters.type === "all" ? undefined : filters.type,
    purpose: filters.purpose === "all" ? undefined : filters.purpose,
    page,
    pageSize: 10,
  });

  const q = filters.search.trim().toLowerCase();
  const rows = (visits.data?.items ?? []).filter((r) =>
    q
      ? r.visitor.fullName.toLowerCase().includes(q) ||
        r.visitor.email.toLowerCase().includes(q) ||
        (r.visitor.organization?.toLowerCase().includes(q) ?? false) ||
        r.purpose.toLowerCase().includes(q)
      : true,
  );

  return (
    <TopNavShell
      nav={<AppTopNav app="staff" active="visits" />}
      filterBar={<VisitFilters value={filters} onChange={onFilters} />}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-fg">
            {t("myVisits.title")}
          </h1>
          <MyVisitsRangeFilter value={tab} onChange={onRange} />
        </div>

        <RecordTable
          frameless
          pagination={
            visits.data && visits.data.totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={visits.data.totalPages}
                onPageChange={setPage}
              />
            ) : undefined
          }
        >
          {visits.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.visitor")}</TableHead>
                  <TableHead>{t("columns.purpose")}</TableHead>
                  <TableHead>{t("columns.noOfGuest")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead>{t("columns.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody striped>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-fg-subtle"
                    >
                      {t("noVisits")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const isGroup = row.isGroupVisit && row.groupName;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <span className="flex items-center gap-3">
                            <Avatar
                              name={
                                isGroup ? row.groupName! : row.visitor.fullName
                              }
                              size="md"
                              accent={row.isGroupVisit ? "group" : "single"}
                            />
                            <span className="flex flex-col">
                              <span className="font-medium text-fg">
                                {isGroup ? row.groupName : row.visitor.fullName}
                              </span>
                              <span className="text-xs text-fg-muted">
                                {isGroup
                                  ? (row.groupContact ?? "")
                                  : row.visitor.email}
                              </span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-fg-muted">
                          {row.purpose}
                        </TableCell>
                        <TableCell className="text-fg-muted">
                          <span className="flex items-center gap-1.5">
                            <CircleUser className="size-4" aria-hidden="true" />
                            {t("guestCount", { count: row.groupSize })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusCell
                            status={row.status}
                            scheduledAt={row.scheduledAt}
                            checkInAt={row.checkInAt}
                            checkOutAt={row.checkOutAt}
                            createdAt={row.createdAt}
                          />
                        </TableCell>
                        <TableCell>
                          {row.status === "REVIEW_REQUESTED" ? (
                            <Button
                              intent="danger"
                              size="sm"
                              className="min-w-28 text-xs"
                              onClick={() =>
                                setSelected({ kind: "request", id: row.id })
                              }
                            >
                              {t("actions.update")}
                            </Button>
                          ) : (
                            <Button
                              intent="neutral"
                              tone="outline"
                              size="sm"
                              className="min-w-28 text-xs"
                              onClick={() =>
                                setSelected({ kind: "request", id: row.id })
                              }
                            >
                              {t("actions.viewDetails")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </RecordTable>
      </div>

      <RequestDrawer selected={selected} onClose={() => setSelected(null)} />
    </TopNavShell>
  );
}

export default function MyVisitsPage() {
  return (
    <RouteGuard home="/staff">
      <MyVisits />
    </RouteGuard>
  );
}
