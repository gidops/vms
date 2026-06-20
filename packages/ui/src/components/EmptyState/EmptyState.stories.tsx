import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox } from "lucide-react";
import { Button } from "../../primitives/Button/Button";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "Components/EmptyState",
  component: EmptyState,
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: Inbox,
    title: "No requests yet",
    description:
      "When hosts invite visitors or raise requests, they will appear here.",
  },
  render: (args) => (
    <div className="w-[28rem]">
      <EmptyState {...args} action={<Button size="sm">Create visit</Button>} />
    </div>
  ),
};
