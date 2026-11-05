"use client";

import { PERMISSIONS } from "@vms/contracts";
import {
  Avatar,
  Button,
  EmptyState,
  Pagination,
  RecordTable,
  SearchInput,
  Spinner,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { Download, History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { ExportVisitorsDialog } from "@/app/[locale]/_components/ExportVisitorsDialog";
import {
  FilterPills,
  SCROLLING_PILLS,
} from "@/app/[locale]/_components/FilterPills";
import { RecordCard } from "@/app/[locale]/_components/RecordCard";
import { StatusCell } from "@/app/[locale]/_components/StatusCell";
import {
  RequestDrawer,
  type SelectedItem,
} from "@/app/[locale]/requests/_components/RequestDrawer";
import { useInsightsHistory } from "@/data/insights/queries";
import type { VisitListItem } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { useDebounced } from "@/shared/useDebounced";
import { addDaysIso, formatWatDateTime, watTodayIso } from "@/shared/wat";

const PAGE_SIZE = 20;
/** Window presets in days ending today (WAT); "all" has no start. */
const RANGES = { "7d": 7, "30d": 30, "90d": 90, all: null } as const;
type HistoryRange = keyof typeof RANGES;

/** `[start of the first day, end of today]` on the WAT clock, as ISO strings. */
export function historyWindow(
  range: HistoryRange,
  today: string = watTodayIso(),
): { dateFrom?: string; dateTo: string } {
  const days = RANGES[range];
  return {
    ...(days
      ? { dateFrom: `${addDaysIso(today, -(days - 1))}T00:00:00+01:00` }
      : {}),
    dateTo: `${today}T23:59:59.999+01:00`,
  };
}

function VisitorCell({ row }: { row: VisitListItem }) {
  const isGroup = row.isGroupVisit && row.groupName;
  return (
    <span className="flex items-center gap-3">
      <Avatar
        name={isGroup ? row.groupName! : row.visitor.fullName}
        size="md"
        accent={row.isGroupVisit ? "group" : "single"}
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-fg">
          {isGroup ? row.groupName : row.visitor.fullName}
        </span>
        <span className="truncate text-xs text-fg-muted">
          {isGroup ? (row.groupContact ?? "") : row.visitor.email}
        </span>
      </span>
    </span>
  );
}

/** Facility-wide for holders of history:read, otherwise the caller's own visits. */
export function HistoryTab() {
  const t = useTranslations("insights.history");
  const tStaff = useTranslations("staff");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const { hasPermission } = useAuth();
  const facility = hasPermission(PERMISSIONS.HISTORY_READ);
  const canExport = hasPermission(PERMISSIONS.REPORT_EXPORT);

  const [range, setRange] = React.useState<HistoryRange>("30d");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SelectedItem | null>(null);
  const debounced = useDebounced(search.trim());

  const history = useInsightsHistory({
    ...historyWindow(range),
    search: debounced || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const data = history.data;
  const columns = facility ? 6 : 5;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <FilterPills
          aria-label={t("range")}
          className={SCROLLING_PILLS}
          value={range}
          onValueChange={(v) => {
            setRange(v);
            setPage(1);
          }}
          options={(Object.keys(RANGES) as HistoryRange[]).map((value) => ({
            value,
            label: t(`ranges.${value}`),
          }))}
        />
        {canExport ? (
          <Button className="self-start" onClick={() => setExportOpen(true)}>
            <Download className="size-4" aria-hidden="true" />
            {t("export")}
          </Button>
        ) : null}
      </div>

      <RecordTable
        frameless
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3
              className="text-xl font-semibold text-primary"
              aria-live="polite"
            >
              {data ? nf.format(data.total) : "—"}{" "}
              <span className="font-normal text-fg-muted">{t("visits")}</span>
            </h3>
            <SearchInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              onClear={() => {
                setSearch("");
                setPage(1);
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="sm:w-80"
            />
          </div>
        }
        isEmpty={!!data && data.items.length === 0}
        emptyState={
          <EmptyState
            icon={History}
            title={debounced ? t("noMatches") : t("empty")}
          />
        }
        pagination={
          data && data.totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={data.totalPages}
              onPageChange={setPage}
            />
          ) : undefined
        }
      >
        {history.isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.visitor")}</TableHead>
                    {facility ? (
                      <TableHead>{t("columns.host")}</TableHead>
                    ) : null}
                    <TableHead>{t("columns.date")}</TableHead>
                    <TableHead>{t("columns.purpose")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t("columns.action")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody striped>
                  {history.isError ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns}
                        className="py-10 text-center text-danger"
                      >
                        {t("error")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.items ?? []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <VisitorCell row={row} />
                        </TableCell>
                        {facility ? (
                          <TableCell className="text-fg-muted">
                            {row.host?.user.fullName ?? t("noHost")}
                          </TableCell>
                        ) : null}
                        <TableCell className="whitespace-nowrap text-fg-muted">
                          {formatWatDateTime(row.scheduledAt ?? null, locale)}
                        </TableCell>
                        <TableCell className="text-fg-muted">
                          {row.purpose}
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
                          <Button
                            intent="neutral"
                            tone="outline"
                            size="sm"
                            className="min-w-28 text-xs"
                            onClick={() =>
                              setSelected({ kind: "request", id: row.id })
                            }
                          >
                            {t("viewDetails")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Small screens: each visit as a tappable card. */}
            <div className="flex flex-col gap-4 md:hidden">
              {history.isError ? (
                <p className="py-10 text-center text-danger">{t("error")}</p>
              ) : (
                (data?.items ?? []).map((row) => {
                  const name =
                    row.isGroupVisit && row.groupName
                      ? row.groupName
                      : row.visitor.fullName;
                  const open = () =>
                    setSelected({ kind: "request", id: row.id });
                  return (
                    <RecordCard
                      key={row.id}
                      eyebrow={formatWatDateTime(
                        row.scheduledAt ?? null,
                        locale,
                      )}
                      title={name}
                      subtitle={
                        row.isGroupVisit
                          ? (row.groupContact ?? undefined)
                          : row.visitor.email
                      }
                      extra={
                        facility ? (
                          <span className="text-sm text-fg-muted">
                            {row.host?.user.fullName ?? t("noHost")}
                          </span>
                        ) : undefined
                      }
                      status={<StatusBadge status={row.status} />}
                      footer={row.purpose}
                      action={
                        <Button
                          intent="neutral"
                          tone="outline"
                          size="sm"
                          className="min-w-28 text-xs"
                          onClick={open}
                        >
                          {t("viewDetails")}
                        </Button>
                      }
                      onOpen={open}
                      openLabel={tStaff("card.openFor", { name })}
                    />
                  );
                })
              )}
            </div>
          </>
        )}
      </RecordTable>

      {canExport ? (
        <ExportVisitorsDialog open={exportOpen} onOpenChange={setExportOpen} />
      ) : null}
      <RequestDrawer selected={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
