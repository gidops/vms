import type { Meta, StoryObj } from "@storybook/react-vite";
import { Download, Printer, QrCode, UserPlus } from "lucide-react";
import { ActionTile } from "./ActionTile";

const meta = {
  title: "Components/ActionTile",
  component: ActionTile,
  args: { icon: UserPlus, children: "Add Visitor" },
  argTypes: {
    intent: { control: "inline-radio", options: ["primary", "neutral"] },
    disabled: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="w-36">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActionTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The admin overview's quick-actions grid. */
export const Grid: Story = {
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-2 gap-3">
      <ActionTile intent="primary" icon={UserPlus}>
        Add Visitor
      </ActionTile>
      <ActionTile icon={Download}>Export Data</ActionTile>
      <ActionTile icon={Printer} disabled>
        Print Badge
      </ActionTile>
      <ActionTile icon={QrCode} disabled>
        Scan QR
      </ActionTile>
    </div>
  ),
};

export const AsLink: Story = {
  render: () => (
    <ActionTile icon={Download} asChild>
      <a href="#export">Export Data</a>
    </ActionTile>
  ),
};
