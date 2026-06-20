import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Bell,
  Clock,
  LayoutDashboard,
  LogIn,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Avatar } from "../../primitives/Avatar/Avatar";
import { Badge } from "../../primitives/Badge/Badge";
import { Button } from "../../primitives/Button/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/Select/Select";
import { SearchInput } from "../../components/SearchInput/SearchInput";
import { StatCard } from "../../components/StatCard/StatCard";
import { StatusBadge } from "../../components/StatusBadge/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/Table/Table";
import { FilterBar } from "../FilterBar/FilterBar";
import { PageHeader } from "../PageHeader/PageHeader";
import { RecordTable } from "../RecordTable/RecordTable";
import { AppShell, type NavItem } from "./AppShell";

const meta = {
  title: "Patterns/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  args: { children: null },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const NAV: NavItem[] = [
  {
    key: "dashboard",
    label: "Today's Schedule",
    icon: LayoutDashboard,
    active: true,
  },
  { key: "requests", label: "Requests & Alerts", icon: ShieldAlert },
  { key: "visitors", label: "Visitors", icon: Users },
];

const ROWS = [
  {
    name: "Judith Francis",
    host: "Finance · 12F",
    time: "9:42 AM",
    status: "CHECKED_IN" as const,
  },
  {
    name: "Amaka Obi",
    host: "Legal · 4F",
    time: "10:05 AM",
    status: "PENDING" as const,
  },
  {
    name: "Tunde Bello",
    host: "IT · 7F",
    time: "8:30 AM",
    status: "CHECKED_OUT" as const,
  },
  {
    name: "Sarah Khan",
    host: "HR · 2F",
    time: "11:15 AM",
    status: "DENIED" as const,
  },
];

export const Dashboard: Story = {
  render: () => (
    <AppShell
      brand={<span className="text-primary">AATC VMS</span>}
      nav={NAV}
      headerStart={
        <div className="w-full max-w-md">
          <SearchInput placeholder="Search visitor, host, floor, pass id" />
        </div>
      }
      headerEnd={
        <>
          <Button
            intent="neutral"
            tone="ghost"
            size="sm"
            aria-label="Notifications"
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
          <Avatar name="Judith Francis" size="sm" />
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Welcome, Judith"
          description="Here's what's happening at the gate today."
          actions={<Button>Create visit</Button>}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Visitors today" value={12} icon={Users} />
          <StatCard label="Currently on-site" value={28} icon={LogIn} />
          <StatCard
            label="Overdue checkout"
            value={16}
            icon={Clock}
            hint="past expected time"
          />
        </div>

        <RecordTable
          toolbar={
            <FilterBar actions={<Button size="sm">Search</Button>}>
              <div className="min-w-56 flex-1">
                <SearchInput placeholder="Search visitor records" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
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
                <TableHead>Visitor</TableHead>
                <TableHead>Host / Floor</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Status</TableHead>
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
  ),
};
