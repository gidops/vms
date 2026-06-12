"use client";

import type { VisitStatus, VisitType } from "@vms/contracts";
import {
  Avatar,
  Button,
  Checkbox,
  FilterBar,
  QuickActionsPanel,
  RecordTable,
  SearchInput,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatStrip,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TopNavShell,
} from "@vms/ui";
import { SquareActivity } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";

interface VisitRow {
  id: string;
  name: string;
  email: string;
  type: VisitType;
  host: string;
  purpose: string;
  timeCreated: string;
  status: VisitStatus;
}

// Mock records until a /visits endpoint exists. Shapes mirror VisitWithVisitor.
const ROWS: VisitRow[] = [
  {
    id: "1",
    name: "Jordan Smith",
    email: "jordan@email.com",
    type: "PRE_INVITED",
    host: "Dr Alabi",
    purpose: "Client Meeting",
    timeCreated: "10:00, May 01, 2026",
    status: "APPROVED",
  },
  {
    id: "2",
    name: "Sophia Davis",
    email: "sophia.davis@email.com",
    type: "WALK_IN",
    host: "8th Floor LW",
    purpose: "General Enquiry",
    timeCreated: "15:30, April 30, 2026",
    status: "CHECKED_IN",
  },
  {
    id: "3",
    name: "Ethan Foster",
    email: "ethan.foster@email.com",
    type: "PRE_INVITED",
    host: "Dr Alabi",
    purpose: "General Enquiry",
    timeCreated: "18:00, April 30, 2026",
    status: "CHECKED_OUT",
  },
  {
    id: "4",
    name: "Ava Singh",
    email: "ava.singh@email.com",
    type: "WALK_IN",
    host: "Dr Alabi",
    purpose: "Client Meeting",
    timeCreated: "14:00, April 25, 2026",
    status: "CHECKED_OUT",
  },
  {
    id: "5",
    name: "Hannah Chen",
    email: "chenny@yahoo.com",
    type: "PRE_INVITED",
    host: "Dr Alabi",
    purpose: "Client Meeting",
    timeCreated: "13:00, April 12, 2026",
    status: "APPROVED",
  },
  {
    id: "6",
    name: "Ryan Baker",
    email: "ryan.baker@email.com",
    type: "WALK_IN",
    host: "Dr Alabi",
    purpose: "Client Meeting",
    timeCreated: "11:30, April 05, 2026",
    status: "CHECKED_IN",
  },
  {
    id: "7",
    name: "Liam Roberts",
    email: "liam.roberts@email.com",
    type: "WALK_IN",
    host: "Dr Alabi",
    purpose: "Client Meeting",
    timeCreated: "16:30, April 01, 2026",
    status: "CANCELLED",
  },
];

function Dashboard() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { user } = useAuth();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const allSelected = selected.size === ROWS.length && ROWS.length > 0;
  const headerState: boolean | "indeterminate" = allSelected
    ? true
    : selected.size > 0
      ? "indeterminate"
      : false;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(ROWS.map((r) => r.id)));

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const channelLabel = (type: VisitType) =>
    type === "WALK_IN" ? t("channel.walkIn") : t("channel.invited");

  const rowAction = (row: VisitRow) => {
    if (row.status === "APPROVED")
      return (
        <Button intent="success" size="sm">
          {t("actions.checkIn")}
        </Button>
      );
    if (row.status === "CHECKED_IN")
      return (
        <Button intent="danger" size="sm">
          {t("actions.checkOut")}
        </Button>
      );
    return (
      <Button intent="neutral" tone="outline" size="sm">
        {t("actions.viewDetails")}
      </Button>
    );
  };

  return (
    <TopNavShell
      nav={<AppTopNav active="schedule" requestsCount={8} />}
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <StatStrip
            items={[
              { label: t("stats.onsite"), value: 12 },
              { label: t("stats.checkedIn"), value: 28 },
              { label: t("stats.checkedOut"), value: 16 },
            ]}
          />
          <QuickActionsPanel
            title={t("quickActions.title")}
            logo={
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/brand/afreximbank.svg"
                alt=""
                className="size-8"
                aria-hidden="true"
              />
            }
          >
            <Button intent="primary">{t("quickActions.registerWalkIn")}</Button>
            <Button intent="accent">{t("quickActions.newInvite")}</Button>
          </QuickActionsPanel>
        </div>

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
                <TableHead className="w-10">
                  <Checkbox
                    checked={headerState}
                    onCheckedChange={toggleAll}
                    aria-label={t("selectAll")}
                  />
                </TableHead>
                <TableHead>{t("columns.visitor")}</TableHead>
                <TableHead>{t("columns.channel")}</TableHead>
                <TableHead>{t("columns.hostUnit")}</TableHead>
                <TableHead>{t("columns.purpose")}</TableHead>
                <TableHead>{t("columns.timeCreated")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody striped>
              {ROWS.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={selected.has(row.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={() => toggleRow(row.id)}
                      aria-label={row.name}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <Avatar name={row.name} size="md" />
                      <span className="flex flex-col">
                        <span className="font-medium text-fg">{row.name}</span>
                        <span className="text-xs text-fg-muted">
                          {row.email}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-fg-muted">
                    {channelLabel(row.type)}
                  </TableCell>
                  <TableCell className="text-fg-muted">{row.host}</TableCell>
                  <TableCell className="text-fg-muted">{row.purpose}</TableCell>
                  <TableCell className="text-fg-muted">
                    {row.timeCreated}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{rowAction(row)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </RecordTable>
      </div>
    </TopNavShell>
  );
}

export default function DashboardPage() {
  return (
    <RouteGuard>
      <Dashboard />
    </RouteGuard>
  );
}
