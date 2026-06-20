import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../primitives/Button/Button";
import { QuickActionsPanel } from "./QuickActionsPanel";

const meta = {
  title: "Patterns/QuickActionsPanel",
  component: QuickActionsPanel,
  parameters: { layout: "padded" },
  args: { title: "Quick actions", children: null },
} satisfies Meta<typeof QuickActionsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="max-w-md">
      <QuickActionsPanel title="Quick actions">
        <Button intent="primary">Register Walk-In</Button>
        <Button intent="accent">New Invite Request</Button>
      </QuickActionsPanel>
    </div>
  ),
};
