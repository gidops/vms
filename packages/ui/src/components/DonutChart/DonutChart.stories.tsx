import type { Meta, StoryObj } from "@storybook/react-vite";
import { DonutChart } from "./DonutChart";

const meta = {
  title: "Components/DonutChart",
  component: DonutChart,
  args: {
    label: "Visit status breakdown, today",
    segments: [
      { key: "in", label: "Checked-in", value: 67, tone: "success" },
      { key: "out", label: "Checked-out", value: 17, tone: "neutral" },
      { key: "rejected", label: "Rejected", value: 13, tone: "danger" },
    ],
  },
  argTypes: {
    size: { control: { type: "range", min: 80, max: 200, step: 10 } },
  },
  decorators: [
    (Story) => (
      <div className="w-72 rounded-xl border border-border bg-surface p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DonutChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every tone, to check contrast in light/dark. */
export const AllTones: Story = {
  args: {
    segments: (
      ["primary", "success", "warning", "danger", "info", "neutral"] as const
    ).map((tone) => ({ key: tone, label: tone, value: 1, tone })),
  },
};

export const Empty: Story = {
  args: {
    segments: [
      { key: "in", label: "Checked-in", value: 0, tone: "success" },
      { key: "out", label: "Checked-out", value: 0, tone: "neutral" },
      { key: "rejected", label: "Rejected", value: 0, tone: "danger" },
    ],
  },
};
