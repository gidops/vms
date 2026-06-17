import type { Meta, StoryObj } from "@storybook/react-vite";
import { SegmentedControl } from "./SegmentedControl";

const meta = {
  title: "Components/SegmentedControl",
  component: SegmentedControl,
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "aria-label": "Date range",
    options: [
      { value: "today", label: "Today" },
      { value: "7d", label: "Last 7 days" },
      { value: "custom", label: "Custom" },
    ],
  },
};

export const OnEmphasis: Story = {
  parameters: { backgrounds: { default: "brand" } },
  decorators: [
    (Story) => (
      <div className="rounded-xl bg-emphasis p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    variant: "onEmphasis",
    "aria-label": "Workspace view",
    defaultValue: "schedule",
    options: [
      { value: "schedule", label: "Today's Schedule" },
      { value: "requests", label: "Requests & Alerts", count: 8 },
    ],
  },
};
