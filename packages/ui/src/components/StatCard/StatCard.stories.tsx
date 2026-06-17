import type { Meta, StoryObj } from "@storybook/react-vite";
import { Clock, LogIn, Users } from "lucide-react";
import { StatCard } from "./StatCard";

const meta = {
  title: "Components/StatCard",
  component: StatCard,
  args: { label: "Visitors today", value: 12 },
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
