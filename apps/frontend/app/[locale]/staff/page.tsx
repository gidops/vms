"use client";

import {
  Avatar,
  cn,
  RecordTable,
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
import { ChevronDown, CircleUser } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { RecordCard } from "@/app/[locale]/_components/RecordCard";
import { StatusCell } from "@/app/[locale]/_components/StatusCell";
import { QuickActionSheet } from "@/app/[locale]/dashboard/_components/QuickActionSheet";
import {
  RequestDrawer,
  type SelectedItem,
} from "@/app/[locale]/requests/_components/RequestDrawer";
import { StaffOverview } from "./_components/StaffOverview";
import { RecentUpdates } from "./_components/RecentUpdates";
import {
  StaffRangeFilter,
  type DateRange,
  type StaffRange,
} from "./_components/StaffRangeFilter";
import {
  VisitFilters,
  type VisitFiltersValue,
} from "./_components/VisitFilters";
import { useMyVisits } from "@/data/requests/queries";
import { useStaffActivityFeed, useStaffStats } from "@/data/staff/queries";
import type { VisitListItem } from "@/data/visits/visits.api";
import type { StaffActivityItem } from "@/data/staff/staff.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Cards shown before Show more: enough to scan without pushing Recent Updates far down. */
const CARDS_BEFORE_MORE = 4;

/** Small screens: the Expected Guests rows as cards, the rest behind Show more. */
function ExpectedGuestCards({
  rows,
  onOpen,
}: {
  rows: VisitListItem[];
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("staff");
  const [expanded, setExpanded] = React.useState(false);
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-fg-subtle md:hidden">
        {t("noVisits")}
      </p>
    );
  }
  const shown = expanded ? rows : rows.slice(0, CARDS_BEFORE_MORE);
  return (
    <div className="flex flex-col gap-4 md:hidden">
      {shown.map((row) => {
        const name =
          row.isGroupVisit && row.groupName
            ? row.groupName
            : row.visitor.fullName;
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
            status={<StatusBadge status={row.status} />}
            footer={
              <span className="flex items-center gap-1.5">
                <CircleUser className="size-4" aria-hidden="true" />
                {t("guestCount", { count: row.groupSize })}
              </span>
            }
            onOpen={() => onOpen(row.id)}
            openLabel={t("card.openFor", { name })}
          />
        );
      })}
      {rows.length > CARDS_BEFORE_MORE ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center justify-center gap-1 border-y border-surface-muted py-3 text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <span className="underline underline-offset-4">
            {expanded ? t("showLess") : t("showMore")}
          </span>
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      ) : null}
    </div>
  );
}

function Staff() {
  const t = useTranslations("staff");
  const { user } = useAuth();

  const [range, setRange] = React.useState<StaffRange>("today");
  // Seeded to "today" so the initial view is bounded.
  const [dateWindow, setDateWindow] = React.useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  });
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

  // Debounced as you type; the Search button / Enter flushes immediately.
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => clearTimeout(id);
  }, [filters.search]);
  const runSearch = () => setDebouncedSearch(filters.search.trim());

  // While searching, the date window is dropped so results span everything in scope.
  const searching = debouncedSearch.length > 0;

  const visits = useMyVisits({
    ...(searching ? {} : dateWindow),
    // Tracks recently submitted requests, so window and sort use createdAt.
    dateField: "createdAt",
    sortBy: "createdAt",
    sortDir: "desc",
    search: debouncedSearch || undefined,
    status: filters.status === "all" ? undefined : filters.status,
    type: filters.type === "all" ? undefined : filters.type,
    purpose: filters.purpose === "all" ? undefined : filters.purpose,
    pageSize: 8,
  });

  const rows = visits.data?.items ?? [];

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
          onSearch={runSearch}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <StaffOverview
          welcome={t("welcome", { name: user?.fullName ?? "" })}
          office={user?.assignedDesk}
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
            frameless
            toolbar={
              // Small screens stack the range under the title on one row that scrolls sideways.
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
                <h2 className="text-xl font-semibold text-primary">
                  {t("expectedGuests")}
                </h2>
                <StaffRangeFilter
                  value={range}
                  disabled={searching}
                  className="max-w-full overflow-x-auto md:overflow-visible"
                  onChange={(next, window) => {
                    setRange(next);
                    if (window) setDateWindow(window);
                  }}
                />
              </div>
            }
          >
            {visits.isLoading ? (
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
                                    name={
                                      isGroup
                                        ? row.groupName!
                                        : row.visitor.fullName
                                    }
                                    size="md"
                                    accent={
                                      row.isGroupVisit ? "group" : "single"
                                    }
                                  />
                                  <span className="flex flex-col">
                                    <span className="font-medium text-fg">
                                      {isGroup
                                        ? row.groupName
                                        : row.visitor.fullName}
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
                                  <CircleUser
                                    className="size-4"
                                    aria-hidden="true"
                                  />
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
                </div>
                <ExpectedGuestCards
                  rows={rows}
                  onOpen={(id) => setSelected({ kind: "request", id })}
                />
              </>
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
