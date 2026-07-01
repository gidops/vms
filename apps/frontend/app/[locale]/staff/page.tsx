"use client";

import {
  Avatar,
  Button,
  FilterBar,
  Input,
  RecordTable,
  Select,
  SegmentedControl,
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
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { QuickActionSheet } from "@/app/[locale]/dashboard/_components/QuickActionSheet";
import {
  RequestDrawer,
  type SelectedItem,
} from "@/app/[locale]/requests/_components/RequestDrawer";
import { StaffOverview } from "./_components/StaffOverview";
import { RecentUpdates } from "./_components/RecentUpdates";
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

/** Recent Guests table header cell — design: 16px semibold uppercase, muted grey. */
const TABLE_HEAD_CN =
  "h-11 text-base font-semibold uppercase tracking-normal text-fg-subtle";

function Staff() {
  const t = useTranslations("staff");
  const tCommon = useTranslations("common");
  const { user } = useAuth();

  const [range, setRange] = React.useState<Range>("today");
  const [invite, setInvite] = React.useState(false);
  const [selected, setSelected] = React.useState<SelectedItem | null>(null);

  const stats = useStaffStats();
  const activity = useStaffActivityFeed();
  const visits = useMyVisits({ ...rangeBounds(range), pageSize: 8 });

  const rows = visits.data?.items ?? [];

  const openActivity = (item: StaffActivityItem) => {
    if (item.alertId) setSelected({ kind: "alert", id: item.alertId });
    else if (item.visitId) setSelected({ kind: "request", id: item.visitId });
  };

  return (
    <TopNavShell
      nav={<AppTopNav app="staff" active="schedule" requestsCount={undefined} />}
      filterBar={
        <FilterBar
          actions={
            <Button size="lg" className="h-12 rounded-lg px-9 font-semibold shadow-lg">
              {t("filters.search")}
            </Button>
          }
        >
          {/* Search takes its base 2 shares PLUS the 0.2 freed by narrowing "All
              Visit types" (flex-[0.8]); the removed 20% flows into the search bar
              while "All Status" / "All Purpose" keep their width. Total stays 5. */}
          <div className="w-full sm:flex-[2.2]">
            <Input
              className="h-12 rounded-lg border-border px-4 text-base text-fg placeholder:text-fg"
              placeholder={t("filters.searchPlaceholder")}
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="h-12 flex-1 rounded-lg text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon("allStatus")}</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            {/* 20% narrower than the other dropdowns (flex-[0.8] vs flex-1); the
                freed share is absorbed by the search bar above. */}
            <SelectTrigger className="h-12 flex-[0.8] rounded-lg text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allVisitTypes")}</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="h-12 flex-1 rounded-lg text-base">
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
        <StaffOverview
          welcome={t("welcome", { name: user?.fullName ?? "" })}
          office={user?.hostOffice}
          onNewInvite={() => setInvite(true)}
          stats={[
            { label: t("stats.expectedToday"), value: stats.data?.expectedToday ?? "—" },
            {
              label: t("stats.awaitingApproval"),
              value: stats.data?.awaitingApproval ?? "—",
            },
            { label: t("stats.onsite"), value: stats.data?.onsite ?? "—" },
          ]}
        />

        {/* Right column fr (1.5) MUST match StaffOverview's book-panel column so
            Recent Updates lines up under it. lg:gap-x-0 + the table's lg:me-6 keep
            the right track partitioning the full width exactly like the overview bar. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(300px,1.5fr)] lg:gap-x-0">
          <RecordTable
            flush
            className="lg:me-6"
            toolbar={
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-lg border border-border p-3">
                <h2 className="text-2xl font-semibold text-fg">
                  {t("recentVisitors")}
                </h2>
                <SegmentedControl
                  aria-label={t("recentVisitors")}
                  value={range}
                  onValueChange={(value) => setRange(value as Range)}
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
                <TableHeader className="[&_tr]:border-border">
                  <TableRow>
                    <TableHead className={TABLE_HEAD_CN}>
                      {t("columns.visitor")}
                    </TableHead>
                    <TableHead className={TABLE_HEAD_CN}>
                      {t("columns.organization")}
                    </TableHead>
                    <TableHead className={TABLE_HEAD_CN}>
                      {t("columns.purpose")}
                    </TableHead>
                    <TableHead className={TABLE_HEAD_CN}>
                      {t("columns.status")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody striped>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-fg-subtle">
                        {t("noVisits")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer border-b-0"
                        onClick={() =>
                          setSelected({ kind: "request", id: row.id })
                        }
                      >
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
                        <TableCell>
                          <StatusBadge
                            status={row.status}
                            tone="outline"
                            dot={false}
                            className="border-border bg-surface"
                          />
                        </TableCell>
                      </TableRow>
                    ))
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
