"use client";

import {
  Avatar,
  RecordTable,
  SegmentedControl,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TopNavShell,
} from "@vms/ui";
import { CalendarClock, CircleUser } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { StatusCell } from "@/app/[locale]/_components/StatusCell";
import { QuickActionSheet } from "@/app/[locale]/dashboard/_components/QuickActionSheet";
import {
  RequestDrawer,
  type SelectedItem,
} from "@/app/[locale]/requests/_components/RequestDrawer";
import { StaffOverview } from "./_components/StaffOverview";
import { RecentUpdates } from "./_components/RecentUpdates";
import { VisitFilters, type VisitFiltersValue } from "./_components/VisitFilters";
import { useMyVisits } from "@/data/requests/queries";
import { useStaffActivityFeed, useStaffStats } from "@/data/staff/queries";
import type { StaffActivityItem } from "@/data/staff/staff.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";

type Range = "today" | "7d" | "custom";

/** [from, to) bounds (ISO) for the Recent Visitors range tabs. */
function rangeBounds(range: Range): { dateFrom?: string; dateTo?: string } {
  if (range === "custom") return {};
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "7d") start.setDate(start.getDate() - 6);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

function Staff() {
  const t = useTranslations("staff");
  const { user } = useAuth();

  const [range, setRange] = React.useState<Range>("today");
  const [invite, setInvite] = React.useState(false);
  const [selected, setSelected] = React.useState<SelectedItem | null>(null);
  const [filters, setFilters] = React.useState<VisitFiltersValue>({
    search: "",
    status: "all",
    type: "all",
    purpose: "all",
  });

  const stats = useStaffStats();
  const activity = useStaffActivityFeed();
  const visits = useMyVisits({
    ...rangeBounds(range),
    status: filters.status === "all" ? undefined : filters.status,
    type: filters.type === "all" ? undefined : filters.type,
    purpose: filters.purpose === "all" ? undefined : filters.purpose,
    pageSize: 8,
  });

  // Free-text search is applied client-side over the fetched page (name / email /
  // organization / purpose), mirroring My Visits.
  const q = filters.search.trim().toLowerCase();
  const rows = (visits.data?.items ?? []).filter((r) =>
    q
      ? r.visitor.fullName.toLowerCase().includes(q) ||
        r.visitor.email.toLowerCase().includes(q) ||
        (r.visitor.organization?.toLowerCase().includes(q) ?? false) ||
        r.purpose.toLowerCase().includes(q)
      : true,
  );

  const openActivity = (item: StaffActivityItem) => {
    if (item.alertId) setSelected({ kind: "alert", id: item.alertId });
    else if (item.visitId) setSelected({ kind: "request", id: item.visitId });
  };

  return (
    <TopNavShell
      nav={
        <AppTopNav app="staff" active="schedule" requestsCount={undefined} />
      }
      filterBar={
        <VisitFilters
          value={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-primary">
            <CalendarClock className="size-4" aria-hidden="true" />
            {t("hub")}
          </span>
          <h1 className="text-3xl font-semibold text-fg">
            {t("welcome", { name: user?.fullName ?? "" })}
          </h1>
        </div>

        <StaffOverview
          office={user?.hostOffice}
          onNewInvite={() => setInvite(true)}
          stats={[
            {
              label: t("stats.expectedToday"),
              value: stats.data?.expectedToday ?? "—",
            },
            {
              label: t("stats.awaitingApproval"),
              value: stats.data?.awaitingApproval ?? "—",
            },
            { label: t("stats.onsite"), value: stats.data?.onsite ?? "—" },
          ]}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
          <RecordTable
            toolbar={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-primary">
                  {t("expectedGuests")}
                </h2>
                <SegmentedControl
                  aria-label={t("expectedGuests")}
                  value={range}
                  onValueChange={(v) => setRange(v as Range)}
                  options={[
                    { value: "today", label: t("range.today") },
                    { value: "7d", label: t("range.last7") },
                    { value: "custom", label: t("range.custom") },
                  ]}
                />
              </div>
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
                  </TableRow>
                </TableHeader>
                <TableBody striped>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-10 text-center text-fg-subtle"
                      >
                        {t("noVisits")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const isGroup = row.isGroupVisit && row.groupName;
                      return (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() =>
                            setSelected({ kind: "request", id: row.id })
                          }
                        >
                          <TableCell>
                            <span className="flex items-center gap-3">
                              <Avatar
                                name={isGroup ? row.groupName! : row.visitor.fullName}
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
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </RecordTable>

          <RecentUpdates
            items={activity.data?.items ?? []}
            isLoading={activity.isLoading}
            onSelect={openActivity}
          />
        </div>
      </div>

      <QuickActionSheet
        mode={invite ? "invite" : null}
        onClose={() => setInvite(false)}
        fixedHostUserId={user?.id}
        fixedHostName={user?.fullName}
      />
      <RequestDrawer selected={selected} onClose={() => setSelected(null)} />
    </TopNavShell>
  );
}

export default function StaffPage() {
  return (
    <RouteGuard home="/staff">
      <Staff />
    </RouteGuard>
  );
}
