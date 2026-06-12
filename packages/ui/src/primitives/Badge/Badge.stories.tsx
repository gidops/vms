import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";

const meta = {
  title: "Primitives/Badge",
  component: Badge,
  args: { children: "Badge", dot: false },
  argTypes: {
    intent: {
      control: "select",
      options: [
        "neutral",
        "primary",
        "accent",
        "success",
        "warning",
        "danger",
        "info",
      ],
    },
    tone: { control: "select", options: ["soft", "solid", "outline"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
    dot: { control: "boolean" },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Intents: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      {(
        [
          "neutral",
          "primary",
          "accent",
          "success",
          "warning",
          "danger",
          "info",
        ] as const
      ).map((intent) => (
        <Badge key={intent} {...args} intent={intent} dot>
          {intent}
        </Badge>
      ))}
    </div>
  ),
};

export const Tones: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      {(["soft", "solid", "outline"] as const).map((tone) => (
        <Badge key={tone} {...args} intent="primary" tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
};
