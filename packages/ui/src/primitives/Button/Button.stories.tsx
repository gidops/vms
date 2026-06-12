import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  args: { children: "Button" },
  argTypes: {
    intent: {
      control: "select",
      options: ["primary", "accent", "neutral", "success", "warning", "danger"],
    },
    tone: {
      control: "select",
      options: ["solid", "soft", "outline", "ghost"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
    fullWidth: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Intents: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} intent="primary">
        Primary
      </Button>
      <Button {...args} intent="accent">
        Accent
      </Button>
      <Button {...args} intent="neutral">
        Neutral
      </Button>
      <Button {...args} intent="success">
        Success
      </Button>
      <Button {...args} intent="warning">
        Warning
      </Button>
      <Button {...args} intent="danger">
        Danger
      </Button>
    </div>
  ),
};

export const Tones: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} tone="solid">
        Solid
      </Button>
      <Button {...args} tone="soft">
        Soft
      </Button>
      <Button {...args} tone="outline">
        Outline
      </Button>
      <Button {...args} tone="ghost">
        Ghost
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};
