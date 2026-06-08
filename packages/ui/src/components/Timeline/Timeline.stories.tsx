import type { Meta, StoryObj } from "@storybook/react-vite";
import { Timeline, type TimelineStep } from "./Timeline";

const meta = {
  title: "Components/Timeline",
  component: Timeline,
  args: { steps: [] },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mirrors the visit lifecycle shown in the Visit Request Details drawer.
const STEPS: TimelineStep[] = [
  {
    key: "invite",
    label: "Invite Created",
    description: "2 Mar, 9:42 AM",
    state: "complete",
  },
  {
    key: "approval",
    label: "Awaiting CSO Approval",
    description: "Approved by J. Francis",
    state: "complete",
  },
  {
    key: "checkin",
    label: "Checked In",
    description: "In progress",
    state: "current",
  },
  { key: "pass", label: "Pass Issued", state: "upcoming" },
  { key: "checkout", label: "Checked Out", state: "upcoming" },
];

export const VisitLifecycle: Story = {
  render: () => (
    <div className="w-80">
      <Timeline steps={STEPS} />
    </div>
  ),
};
