import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { YesNoControl } from "./YesNoControl";

const meta = {
  title: "Components/YesNoControl",
  component: YesNoControl,
  args: {
    value: null,
    onValueChange: () => {},
    yesLabel: "Yes",
    noLabel: "No",
    "aria-label": "Need help evacuating in an emergency?",
  },
} satisfies Meta<typeof YesNoControl>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled(props: React.ComponentProps<typeof YesNoControl>) {
  const [value, setValue] = React.useState<boolean | null>(props.value);
  return <YesNoControl {...props} value={value} onValueChange={setValue} />;
}

export const Unanswered: Story = { render: (args) => <Controlled {...args} /> };
export const AnsweredYes: Story = {
  args: { value: true },
  render: (args) => <Controlled {...args} />,
};
export const Invalid: Story = {
  args: { invalid: true },
  render: (args) => <Controlled {...args} />,
};
export const FullWidth: Story = {
  args: { fullWidth: true },
  render: (args) => (
    <div className="w-[360px]">
      <Controlled {...args} />
    </div>
  ),
};
