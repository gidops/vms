import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert, AlertDescription, AlertTitle } from "./Alert";

const meta = {
  title: "Components/Alert",
  component: Alert,
  argTypes: {
    intent: {
      control: "select",
      options: ["neutral", "info", "success", "warning", "danger"],
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { intent: "danger" },
  render: (args) => (
    <Alert {...args} className="max-w-md">
      <AlertTitle>Flagged visitor</AlertTitle>
      <AlertDescription>
        Do not check in this visitor without Security Manager review.
      </AlertDescription>
    </Alert>
  ),
};

export const Intents: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      {(["info", "success", "warning", "danger"] as const).map((intent) => (
        <Alert key={intent} intent={intent}>
          <AlertTitle className="capitalize">{intent}</AlertTitle>
          <AlertDescription>An example {intent} message.</AlertDescription>
        </Alert>
      ))}
    </div>
  ),
};
