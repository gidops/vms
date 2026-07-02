"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  FilterBar,
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
import { SquareActivity, Users } from "lucide-react";
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
import { VmcOverview } from "@/app/[locale]/dashboard/_components/VmcOverview";
import { visitsApi, type VisitListItem } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** The VMC board only surfaces visits that a CSO has cleared for reception. */
const BOARD_STATUSES = ["APPROVED", "CHECKED_IN", "CHECKED_OUT"] as const;

function Dashboard() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const { user } = useAuth();

  const visitsQ = useQuery({
    queryKey: ["visits", "dashboard"] as const,
    queryFn: () => visitsApi.list({ statuses: [...BOARD_STATUSES], pageSize: 50 }),
  });
  const rows = React.useMemo(() => visitsQ.data?.items ?? [], [visitsQ.data]);

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

  // A group visit opens the group sheet; a bulk/single visit goes straight to the
  // check-in modal.
  const startCheckIn = (row: VisitListItem) => {
    if (row.isGroupVisit && row.groupId) setGroupCheckIn(row.groupId);
    else setCheckInId(row.id);
  };

  const rowAction = (row: VisitListItem) => {
    if (row.status === "APPROVED")
      return (
        <Button intent="success" size="sm" onClick={() => startCheckIn(row)}>
          {t("actions.checkIn")}
        </Button>
      );
    if (row.status === "CHECKED_IN")
      return (
        <Button intent="danger" size="sm" onClick={() => setCheckOutId(row.id)}>
          {t("actions.checkOut")}
        </Button>
      );
    return (
      <Button
        intent="neutral"
        tone="outline"
        size="sm"
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
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-primary">
            <SquareActivity className="size-4" aria-hidden="true" />
            {t("hub")}
          </span>
          <h1 className="text-3xl font-semibold text-fg">
            {t("welcome", { name: user?.fullName ?? "" })}
          </h1>
        </div>

        <VmcOverview
          stats={[
            { label: t("stats.onsite"), value: 12 },
            { label: t("stats.checkedIn"), value: 28 },
            { label: t("stats.checkedOut"), value: 16 },
          ]}
          onRegisterWalkIn={() => setQuickAction("walkin")}
          onNewInvite={() => setQuickAction("invite")}
        />

        <RecordTable
          toolbar={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-primary">
                {t("records")}
              </h2>
              <SegmentedControl
                aria-label={t("records")}
                defaultValue="today"
                options={[
                  { value: "today", label: t("range.today") },
                  { value: "7d", label: t("range.last7") },
                  { value: "custom", label: t("range.custom") },
                ]}
              />
            </div>
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
                <TableHead>{t("columns.timeCreated")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody striped>
              {visitsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8}>
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
                          accent={row.isGroupVisit ? "amber" : "green"}
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
                        <Users className="size-4" aria-hidden="true" />
                        {t("guestCount", { count: row.groupSize })}
                      </span>
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
