"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  FilterBar,
  Pagination,
  RecordTable,
  SearchInput,
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
import { CircleUser } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { VisitDetailSheet } from "@/app/[locale]/_components/VisitDetailSheet";
import { CheckInModal } from "@/app/[locale]/dashboard/_components/checkin/CheckInModal";
import { CheckOutModal } from "@/app/[locale]/dashboard/_components/checkin/CheckOutModal";
import { GroupCheckInSheet } from "@/app/[locale]/dashboard/_components/checkin/GroupCheckInSheet";
import {
  QuickActionSheet,
  type QuickActionMode,
} from "@/app/[locale]/dashboard/_components/QuickActionSheet";
import {
  RecordsRangeFilter,
  type DateRange,
  type RecordsRange,
} from "@/app/[locale]/dashboard/_components/RecordsRangeFilter";
import { VmcOverview } from "@/app/[locale]/dashboard/_components/VmcOverview";
import { visitsApi, type VisitListItem } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** The VMC board only surfaces visits that a Security Manager has cleared for reception. */
const BOARD_STATUSES = ["APPROVED", "CHECKED_IN", "CHECKED_OUT"] as const;

/**
 * Live-ticking elapsed time since a visitor checked in, shown under the "Onsite"
 * status pill (HH:MM:SS). Owns its own interval so only this cell re-renders each
 * second rather than the whole table.
 */
function OnsiteElapsed({ since }: { since: string }) {
  const t = useTranslations("dashboard");
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const totalSec = Math.max(
    0,
    Math.floor((now - new Date(since).getTime()) / 1000),
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(Math.floor(totalSec / 3600))}:${pad(
    Math.floor((totalSec % 3600) / 60),
  )}:${pad(totalSec % 60)}`;
  return (
    <span className="text-xs text-fg-muted">
      {t("onsiteElapsed", { time })}
    </span>
  );
}

function Dashboard() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const { user } = useAuth();

  const [page, setPage] = React.useState(1);
  const [range, setRange] = React.useState<RecordsRange>("all");
  const [dates, setDates] = React.useState<DateRange>({});
  const visitsQ = useQuery({
    queryKey: [
      "visits",
      "dashboard",
      page,
      dates.dateFrom,
      dates.dateTo,
    ] as const,
    queryFn: () =>
      visitsApi.list({
        statuses: [...BOARD_STATUSES],
        page,
        pageSize: 10,
        dateFrom: dates.dateFrom,
        dateTo: dates.dateTo,
      }),
    placeholderData: (prev) => prev,
  });
  const rows = React.useMemo(() => visitsQ.data?.items ?? [], [visitsQ.data]);

  // Changing the window resets to page 1 (page is part of the query key).
  const onRangeChange = (next: RecordsRange, window?: DateRange) => {
    setRange(next);
    setDates(window ?? {});
    setPage(1);
  };

  const [quickAction, setQuickAction] = React.useState<QuickActionMode | null>(
    null,
  );
  const [checkInId, setCheckInId] = React.useState<string | null>(null);
  const [checkOutId, setCheckOutId] = React.useState<string | null>(null);
  const [groupCheckIn, setGroupCheckIn] = React.useState<string | null>(null);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const channelLabel = (type: string) =>
    type === "WALK_IN" ? t("channel.walkIn") : t("channel.invited");

  const hostUnit = (row: VisitListItem) =>
    row.host?.user.fullName ?? row.floor ?? "—";

  // The time shown under the status pill is status-specific: an Expected visit
  // shows when they're scheduled to arrive, a Checked-Out one shows when they
  // left. (Onsite renders the live elapsed timer instead — handled in the cell.)
  const underPillTime = (row: VisitListItem): string | null => {
    if (row.status === "APPROVED") return row.scheduledAt ?? null;
    if (row.status === "CHECKED_OUT") return row.checkOutAt ?? null;
    return row.createdAt;
  };

  // A group visit opens the group sheet; a bulk/single visit goes straight to the
  // check-in modal.
  const startCheckIn = (row: VisitListItem) => {
    if (row.isGroupVisit && row.groupId) setGroupCheckIn(row.groupId);
    else setCheckInId(row.id);
  };

  // Shared size so the ACTION column reads uniformly regardless of which action
  // a row shows (Check-In / Check-Out / View Details): smaller label + a min width
  // wide enough for the longest ("View Details") so all three match.
  const actionButtonClass = "min-w-28 text-xs";

  const rowAction = (row: VisitListItem) => {
    if (row.status === "APPROVED")
      return (
        <Button
          intent="primary"
          size="sm"
          className={actionButtonClass}
          onClick={() => startCheckIn(row)}
        >
          {t("actions.checkIn")}
        </Button>
      );
    if (row.status === "CHECKED_IN")
      return (
        <Button
          intent="danger"
          size="sm"
          className={actionButtonClass}
          onClick={() => setCheckOutId(row.id)}
        >
          {t("actions.checkOut")}
        </Button>
      );
    return (
      <Button
        intent="neutral"
        tone="outline"
        size="sm"
        className={actionButtonClass}
        onClick={() => setDetailId(row.id)}
      >
        {t("actions.viewDetails")}
      </Button>
    );
  };

  return (
    <TopNavShell
      nav={<AppTopNav active="schedule" />}
      filterBar={
        <FilterBar actions={<Button>{t("filters.search")}</Button>}>
          <div className="min-w-56 flex-1">
            <SearchInput placeholder={t("filters.searchPlaceholder")} />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon("allStatus")}</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allVisitTypes")}</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allPurpose")}</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
      }
    >
      <div className="flex flex-col gap-6">
        <VmcOverview
          welcome={t("welcome", { name: user?.fullName ?? "" })}
          stats={[
            { label: t("stats.onsite"), value: 12 },
            { label: t("stats.checkedIn"), value: 28 },
            { label: t("stats.checkedOut"), value: 16 },
          ]}
          onRegisterWalkIn={() => setQuickAction("walkin")}
          onNewInvite={() => setQuickAction("invite")}
        />

        <RecordTable
          frameless
          toolbar={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-primary">
                {t("records")}
              </h2>
              <RecordsRangeFilter value={range} onChange={onRangeChange} />
            </div>
          }
          pagination={
            <Pagination
              page={page}
              totalPages={visitsQ.data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.visitor")}</TableHead>
                <TableHead>{t("columns.channel")}</TableHead>
                <TableHead>{t("columns.hostUnit")}</TableHead>
                <TableHead>{t("columns.purpose")}</TableHead>
                <TableHead>{t("columns.guestCount")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody striped>
              {visitsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex justify-center py-10">
                      <Spinner />
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <Avatar
                          name={
                            row.isGroupVisit && row.groupName
                              ? row.groupName
                              : row.visitor.fullName
                          }
                          size="md"
                          accent={row.isGroupVisit ? "group" : "single"}
                        />
                        <span className="flex flex-col">
                          <span className="font-medium text-fg">
                            {row.isGroupVisit && row.groupName
                              ? row.groupName
                              : row.visitor.fullName}
                          </span>
                          <span className="text-xs text-fg-muted">
                            {row.isGroupVisit
                              ? (row.groupContact ?? "")
                              : row.visitor.email}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {channelLabel(row.type)}
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {hostUnit(row)}
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
                      <span className="flex flex-col items-start gap-1">
                        <StatusBadge status={row.status} />
                        {row.status === "CHECKED_IN" && row.checkInAt ? (
                          <OnsiteElapsed since={row.checkInAt} />
                        ) : (
                          (() => {
                            const ts = underPillTime(row);
                            return ts ? (
                              <span className="text-xs text-fg-muted">
                                {format.dateTime(new Date(ts), {
                                  timeStyle: "short",
                                })}
                              </span>
                            ) : null;
                          })()
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{rowAction(row)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </RecordTable>
      </div>

      <QuickActionSheet
        mode={quickAction}
        onClose={() => setQuickAction(null)}
        onRequestCheckIn={(groupId) => setGroupCheckIn(groupId)}
        onRequestCheckInSingle={(visitId) => setCheckInId(visitId)}
      />
      {checkInId ? (
        <CheckInModal visitId={checkInId} onClose={() => setCheckInId(null)} />
      ) : null}
      {checkOutId ? (
        <CheckOutModal
          visitId={checkOutId}
          onClose={() => setCheckOutId(null)}
        />
      ) : null}
      {groupCheckIn ? (
        <GroupCheckInSheet
          groupId={groupCheckIn}
          onClose={() => setGroupCheckIn(null)}
        />
      ) : null}
      {detailId ? (
        <VisitDetailSheet
          kind="request"
          id={detailId}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </TopNavShell>
  );
}

export default function DashboardPage() {
  return (
    <RouteGuard home="/dashboard">
      <Dashboard />
    </RouteGuard>
  );
}
