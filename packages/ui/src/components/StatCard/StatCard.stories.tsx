import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ChevronRight,
  CircleCheck,
  Clock,
  LogIn,
  LogOut,
  UserRound,
  Users,
} from "lucide-react";
import { StatCard } from "./StatCard";

const meta = {
  title: "Components/StatCard",
  component: StatCard,
  args: { label: "Visitors today", value: 12 },
  argTypes: {
    layout: { control: "inline-radio", options: ["inline", "stacked"] },
    tone: {
      control: "inline-radio",
      options: ["primary", "success", "warning", "info", "neutral"],
    },
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { label: "Visitors today", value: 12, icon: Users },
  render: (args) => (
    <div className="w-64">
      <StatCard {...args} />
    </div>
  ),
};

export const DashboardRow: Story = {
  render: () => (
    <div className="grid w-[42rem] grid-cols-3 gap-4">
      <StatCard label="Visitors today" value={12} icon={Users} />
      <StatCard label="Currently on-site" value={28} icon={LogIn} />
      <StatCard
        label="Overdue checkout"
        value={16}
        icon={Clock}
        hint="past expected time"
      />
    </div>
  ),
};

const chevron = (
  <a
    href="#detail"
    aria-label="Open details"
    className="rounded text-fg-muted hover:text-fg"
  >
    <ChevronRight className="size-5" aria-hidden="true" />
  </a>
);

/** Admin overview: icon chip on top, tinted per metric, with trend + chevron. */
export const Stacked: Story = {
  render: () => (
    <div className="grid w-[52rem] grid-cols-5 gap-4">
      <StatCard
        layout="stacked"
        tone="success"
        icon={Users}
        label="Visitors Today"
        value={128}
        trend={{ value: 14, direction: "up", label: "from yesterday" }}
        action={chevron}
      />
      <StatCard
        layout="stacked"
        tone="success"
        icon={CircleCheck}
        label="Expected Visitors"
        value={96}
        hint="Approved for today"
      />
      <StatCard
        layout="stacked"
        tone="warning"
        icon={Clock}
        label="Pending Requests"
        value={18}
        hint="5 awaiting more info"
        action={chevron}
      />
      <StatCard
        layout="stacked"
        tone="info"
        icon={UserRound}
        label="Onsite"
        value={85}
        hint="On site now"
      />
      <StatCard
        layout="stacked"
        tone="neutral"
        icon={LogOut}
        label="Checked Out"
        value={43}
        trend={{ value: 3, direction: "down", label: "from yesterday" }}
      />
    </div>
  ),
};
