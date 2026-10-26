import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart } from "./BarChart";

const days = Array.from({ length: 30 }, (_, i) => ({
  key: `2026-10-${String(i + 1).padStart(2, "0")}`,
  label: `Oct ${i + 1}`,
  // Weekday peaks, quiet weekends.
  value: i % 7 >= 5 ? 2 + (i % 3) : 12 + ((i * 7) % 11),
}));

const meta = {
  title: "Components/BarChart",
  component: BarChart,
  args: {
    label: "Daily visitor volume, last 30 days",
    data: days,
  },
  argTypes: {
    height: { control: { type: "range", min: 120, max: 320, step: 10 } },
    labelEvery: { control: { type: "range", min: 1, max: 10, step: 1 } },
    tone: {
      control: "inline-radio",
      options: ["primary", "success", "danger"],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[32rem] rounded-xl border border-border bg-surface p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Weekly: Story = {
  args: {
    label: "Weekly visitor volume, last 12 weeks",
    data: Array.from({ length: 12 }, (_, i) => ({
      label: `W${i + 1}`,
      value: 40 + ((i * 13) % 25),
    })),
  },
};

export const Danger: Story = {
  args: { label: "Denied requests per day", tone: "danger" },
};

export const AllZero: Story = {
  args: { data: days.map((d) => ({ ...d, value: 0 })) },
};
