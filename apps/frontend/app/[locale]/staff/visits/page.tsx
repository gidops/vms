"use client";

import type { VisitStatus, VisitType } from "@vms/contracts";
import { VISIT_PURPOSES } from "@vms/contracts";
import {
  Avatar,
  Button,
  FilterBar,
  Pagination,
  RecordTable,
  SearchInput,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TopNavShell,
} from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import {
  RequestDrawer,
  type SelectedItem,
} from "@/app/[locale]/requests/_components/RequestDrawer";
import { useMyVisits } from "@/data/requests/queries";
import { RouteGuard } from "@/shared/auth/RouteGuard";

type Tab = "today" | "upcoming" | "yesterday";

const STATUSES: VisitStatus[] = [
  "PENDING",
  "NEEDS_MORE_INFO",
  "APPROVED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "DENIED",
  "CANCELLED",
  "EXPIRED",
];

const TYPES: VisitType[] = ["PRE_INVITED", "WALK_IN", "APPOINTMENT"];

/** [from, to) bounds (ISO) over the scheduled date for each tab. */
function tabBounds(tab: Tab): { dateFrom?: string; dateTo?: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (tab === "today") {
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }
  if (tab === "yesterday") {
    const yStart = new Date(start);
    yStart.setDate(yStart.getDate() - 1);
    const yEnd = new Date(yStart);
    yEnd.setHours(23, 59, 59, 999);
    return { dateFrom: yStart.toISOString(), dateTo: yEnd.toISOString() };
  }
  // upcoming: from the start of tomorrow onward
  const tomorrow = new Date(start);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { dateFrom: tomorrow.toISOString() };
}

function MyVisits() {
  const t = useTranslations("staff");
  const tCommon = useTranslations("common");
  const tDash = useTranslations("dashboard");
  const format = useFormatter();

  const [tab, setTab] = React.useState<Tab>("today");
  const [status, setStatus] = React.useState<VisitStatus | "all">("all");
  const [type, setType] = React.useState<VisitType | "all">("all");
  const [purpose, setPurpose] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<SelectedItem | null>(null);

  // Changing any filter resets paging to the first page.
  const onTab = (v: Tab) => {
    setTab(v);
    setPage(1);
  };
  const onStatus = (v: VisitStatus | "all") => {
    setStatus(v);
    setPage(1);
  };
  const onType = (v: VisitType | "all") => {
    setType(v);
    setPage(1);
  };
  const onPurpose = (v: string) => {
    setPurpose(v);
    setPage(1);
  };

  const visits = useMyVisits({
    ...tabBounds(tab),
    status: status === "all" ? undefined : status,
    type: type === "all" ? undefined : type,
    purpose: purpose === "all" ? undefined : purpose,
    page,
    pageSize: 10,
  });

  const q = search.trim().toLowerCase();
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
      filterBar={
        <FilterBar actions={<Button>{tDash("filters.search")}</Button>}>
          <div className="min-w-56 flex-1">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder={t("filters.searchPlaceholder")}
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => onStatus(v as VisitStatus | "all")}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon("allStatus")}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={type}
            onValueChange={(v) => onType(v as VisitType | "all")}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {tDash("filters.allVisitTypes")}
              </SelectItem>
              {TYPES.map((ty) => (
                <SelectItem key={ty} value={ty}>
                  {t(`visitType.${ty}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={purpose} onValueChange={onPurpose}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tDash("filters.allPurpose")}</SelectItem>
              {VISIT_PURPOSES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-fg">
            {t("myVisits.title")}
          </h1>
          <SegmentedControl
            aria-label={t("myVisits.title")}
            value={tab}
            onValueChange={(v) => onTab(v as Tab)}
            options={[
              { value: "today", label: t("range.today") },
              { value: "upcoming", label: t("range.upcoming") },
              { value: "yesterday", label: t("range.yesterday") },
            ]}
          />
        </div>

        <RecordTable
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
                  <TableHead>{t("columns.organization")}</TableHead>
                  <TableHead>{t("columns.purpose")}</TableHead>
                  <TableHead>{t("columns.timeCreated")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead>{t("columns.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody striped>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-fg-subtle"
                    >
                      {t("noVisits")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <Avatar name={row.visitor.fullName} size="md" />
                          <span className="flex flex-col">
                            <span className="font-medium text-fg">
                              {row.visitor.fullName}
                            </span>
                            <span className="text-xs text-fg-muted">
                              {row.visitor.email}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-fg-muted">
                        {row.visitor.organization ?? "—"}
                      </TableCell>
                      <TableCell className="text-fg-muted">
                        {row.purpose}
                      </TableCell>
                      <TableCell className="text-fg-muted">
                        {format.dateTime(new Date(row.createdAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>
                        {row.status === "NEEDS_MORE_INFO" ? (
                          <Button
                            intent="danger"
                            size="sm"
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
                            onClick={() =>
                              setSelected({ kind: "request", id: row.id })
                            }
                          >
                            {t("actions.viewDetails")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
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
