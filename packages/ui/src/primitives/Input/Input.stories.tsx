import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "../Label/Label";
import { Input } from "./Input";

const meta = {
  title: "Primitives/Input",
  component: Input,
  args: { placeholder: "Search visitor, host, floor, pass id" },
  argTypes: {
    invalid: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex w-80 flex-col gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input {...args} id="email" type="email" placeholder="name@aatc.org" />
    </div>
  ),
};

export const Invalid: Story = {
  args: { invalid: true, defaultValue: "not-an-email" },
  render: (args) => (
    <div className="flex w-80 flex-col gap-1.5">
      <Label htmlFor="email-invalid">Email</Label>
      <Input {...args} id="email-invalid" />
      <span className="text-xs text-danger">Enter a valid email address.</span>
    </div>
  ),
};
