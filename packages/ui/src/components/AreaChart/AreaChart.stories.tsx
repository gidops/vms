import type { Meta, StoryObj } from "@storybook/react-vite";
import { AreaChart } from "./AreaChart";

const meta = {
  title: "Components/AreaChart",
  component: AreaChart,
  args: {
    label: "Check-ins per hour, today",
    data: [
      { label: "08", value: 6 },
      { label: "10", value: 14 },
      { label: "12", value: 24 },
      { label: "14", value: 19 },
      { label: "16", value: 15 },
      { label: "17", value: 10 },
    ],
  },
  argTypes: {
    height: { control: { type: "range", min: 120, max: 320, step: 10 } },
    gridLines: { control: { type: "range", min: 0, max: 8, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="w-[32rem] rounded-xl border border-border bg-surface p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllZero: Story = {
  args: {
    data: ["08", "10", "12", "14", "16", "17"].map((label) => ({
      label,
      value: 0,
    })),
  },
};
