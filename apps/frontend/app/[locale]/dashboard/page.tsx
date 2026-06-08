"use client";

import type { VisitStatus } from "@vms/contracts";
import {
  AppShell,
  Avatar,
  Badge,
  Button,
  FilterBar,
  type NavItem,
  PageHeader,
  RecordTable,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import {
  Bell,
  Clock,
  LayoutDashboard,
  LogIn,
  LogOut,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";

const ROWS: {
  name: string;
  host: string;
  time: string;
  status: VisitStatus;
}[] = [
  {
    name: "Judith Francis",
    host: "Finance · 12F",
    time: "9:42 AM",
    status: "CHECKED_IN",
  },
  {
    name: "Amaka Obi",
    host: "Legal · 4F",
    time: "10:05 AM",
    status: "PENDING",
  },
  {
    name: "Tunde Bello",
    host: "IT · 7F",
    time: "8:30 AM",
    status: "CHECKED_OUT",
  },
  { name: "Sarah Khan", host: "HR · 2F", time: "11:15 AM", status: "DENIED" },
];

function Dashboard() {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");
  const tCommon = useTranslations("common");
  const { user, logout } = useAuth();

  const nav: NavItem[] = [
    {
      key: "schedule",
      label: tNav("schedule"),
      icon: LayoutDashboard,
      href: "/dashboard",
      active: true,
    },
    { key: "requests", label: tNav("requests"), icon: ShieldAlert, href: "#" },
    { key: "visitors", label: tNav("visitors"), icon: Users, href: "#" },
  ];

  return (
    <AppShell
      brand={<span className="text-primary">{tApp("name")}</span>}
      nav={nav}
      headerStart={
        <div className="w-full max-w-md">
          <SearchInput placeholder={t("search")} />
        </div>
      }
      headerEnd={
        <>
          <Button
            intent="neutral"
            tone="ghost"
            size="sm"
            aria-label={tCommon("notifications")}
          >
            <span className="relative">
              <Bell className="size-5" aria-hidden="true" />
              <Badge
                intent="warning"
                tone="solid"
                size="sm"
                className="absolute -end-2 -top-2 size-4 justify-center p-0"
              >
                1
              </Badge>
            </span>
          </Button>
          <Avatar name={user?.fullName ?? "User"} size="sm" />
          <Button
            intent="neutral"
            tone="ghost"
            size="sm"
            aria-label={tCommon("logout")}
            onClick={() => void logout()}
          >
            <LogOut className="size-5" aria-hidden="true" />
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("welcome", { name: user?.fullName ?? "" })}
          description={t("subtitle")}
          actions={<Button>{t("createVisit")}</Button>}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t("stats.today")} value={12} icon={Users} />
          <StatCard label={t("stats.onsite")} value={28} icon={LogIn} />
          <StatCard
            label={t("stats.overdue")}
            value={16}
            icon={Clock}
            hint={t("stats.overdueHint")}
          />
        </div>

        <RecordTable
          toolbar={
            <FilterBar actions={<Button size="sm">{t("searchAction")}</Button>}>
              <div className="min-w-56 flex-1">
                <SearchInput placeholder={t("searchRecords")} />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon("allStatus")}</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.visitor")}</TableHead>
                <TableHead>{t("columns.host")}</TableHead>
                <TableHead>{t("columns.checkin")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row.name}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar name={row.name} size="sm" />
                      <span className="font-medium">{row.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-fg-muted">{row.host}</TableCell>
                  <TableCell className="text-fg-muted">{row.time}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </RecordTable>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <RouteGuard>
      <Dashboard />
    </RouteGuard>
  );
}
