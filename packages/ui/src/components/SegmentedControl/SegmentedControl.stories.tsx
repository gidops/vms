import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { SegmentedControl } from "./SegmentedControl";

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const meta = {
  title: "Components/SegmentedControl",
  component: SegmentedControl,
  argTypes: {
    variant: { control: "inline-radio", options: ["default", "onEmphasis"] },
    tone: { control: "inline-radio", options: ["neutral", "primary"] },
    invalid: { control: "boolean" },
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    fullWidth: { control: "boolean" },
    onValueChange: { action: "valueChange" },
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: {
    "aria-label": "Date range",
    options: [
      { value: "today", label: "Today" },
      { value: "7d", label: "Last 7 days" },
      { value: "custom", label: "Custom" },
    ],
    variant: "default",
    tone: "neutral",
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

/** A required Yes/No question: starts unanswered, arrows only move focus until answered. */
export const YesNoQuestion: Story = {
  args: {
    "aria-label": "Do you need help to evacuate?",
    options: yesNo,
    tone: "primary",
    required: true,
    fullWidth: true,
  },
  render: function Render(args) {
    const [value, setValue] = React.useState<string | null>(null);
    return (
      <div className="w-80">
        <SegmentedControl {...args} value={value} onValueChange={setValue} />
      </div>
    );
  },
};

export const YesNoInvalid: Story = {
  args: { ...YesNoQuestion.args, value: null, invalid: true },
};
