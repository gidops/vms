"use client";

import {
  Avatar,
  Button,
  cn,
  FilterBar,
  Input,
  RecordTable,
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
            <Button size="lg" className="h-12 rounded-lg px-9 font-semibold">
              {t("filters.search")}
            </Button>
          }
        >
          {/* Search scales ~2:1 against the dropdowns (the design's ratio) so the
              row keeps the design's proportions at every width and "All Visit
              types" stays under the nav's "Updates" tab — a fixed px width drifts
              at non-1440 viewports. */}
          <div className="w-full sm:flex-[2]">
            <Input
              className="h-12 rounded-lg border-[#d9d9d9] px-4 text-base text-[#1e1e1e] placeholder:text-[#1e1e1e]"
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
            <SelectTrigger className="h-12 flex-1 rounded-lg text-base">
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
            className="lg:me-6"
            toolbar={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-black">
                  {t("recentVisitors")}
                </h2>
                <div
                  role="radiogroup"
                  aria-label={t("recentVisitors")}
                  className="flex items-center gap-2"
                >
                  {(
                    [
                      { value: "today", label: t("range.today") },
                      { value: "7d", label: t("range.last7") },
                      { value: "custom", label: t("range.custom") },
                    ] as const
                  ).map((opt) => {
                    const active = range === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setRange(opt.value)}
                        className={cn(
                          "inline-flex h-[35px] items-center justify-center rounded-full bg-white text-base tracking-[-0.48px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                          active
                            ? "border-2 border-[#00736e] px-6 font-semibold text-[#00736e]"
                            : "border border-[#e6e9ee] px-3 font-medium text-[#858d9d] hover:text-[#00736e]",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
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
                    <TableHead>{t("columns.organization")}</TableHead>
                    <TableHead>{t("columns.purpose")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
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
                        className="cursor-pointer"
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
                            className="border-[#e6e9ee] bg-white"
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
