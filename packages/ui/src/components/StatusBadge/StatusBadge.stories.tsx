import type { VisitStatus } from "@vms/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBadge } from "./StatusBadge";

const ALL_STATUSES: VisitStatus[] = [
  "PENDING",
  "REVIEW_REQUESTED",
  "APPROVED",
  "DENIED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "EXPIRED",
];

const meta = {
  title: "Components/StatusBadge",
  component: StatusBadge,
  args: { status: "CHECKED_IN" },
  argTypes: {
    status: { control: "select", options: ALL_STATUSES },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {ALL_STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};
