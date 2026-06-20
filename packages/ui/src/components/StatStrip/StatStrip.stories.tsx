import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatStrip } from "./StatStrip";

const meta = {
  title: "Components/StatStrip",
  component: StatStrip,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StatStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { label: "Onsite Visitors", value: 12 },
      { label: "Checked-in Today", value: 28 },
      { label: "Checked-Out Today", value: 16 },
    ],
  },
};
