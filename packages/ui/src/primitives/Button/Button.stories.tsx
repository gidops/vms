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

const INTENTS = [
  "primary",
  "accent",
  "neutral",
  "success",
  "warning",
  "danger",
] as const;
const TONES = ["solid", "soft", "outline", "ghost"] as const;

const label = "text-xs font-medium uppercase tracking-wide text-fg-muted";

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

/**
 * Every intent (rows) at every tone (columns). `neutral` + `outline` is the app's
 * "secondary" button — a light fill with a soft gray border (see Secondary).
 */
export const Matrix: Story = {
  render: () => (
    <div className="inline-grid grid-cols-[auto_repeat(4,minmax(0,7rem))] items-center gap-3">
      <span />
      {TONES.map((tone) => (
        <span key={`h-${tone}`} className={label}>
          {tone}
        </span>
      ))}
      {INTENTS.flatMap((intent) => [
        <span key={`l-${intent}`} className={label}>
          {intent}
        </span>,
        ...TONES.map((tone) => (
          <Button
            key={`${intent}-${tone}`}
            intent={intent}
            tone={tone}
            size="sm"
          >
            Button
          </Button>
        )),
      ])}
    </div>
  ),
};

/** The secondary button used across the app (e.g. the VMC table "View Details"). */
export const Secondary: Story = {
  args: { intent: "neutral", tone: "outline", children: "View Details" },
};
