import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "../Label/Label";
import { Textarea } from "./Textarea";

const meta = {
  title: "Primitives/Textarea",
  component: Textarea,
  args: { placeholder: "Enter visit notes" },
  argTypes: {
    invalid: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex w-80 flex-col gap-1.5">
      <Label htmlFor="notes">Visit notes</Label>
      <Textarea {...args} id="notes" />
    </div>
  ),
};

export const Invalid: Story = {
  args: { invalid: true, defaultValue: "" },
  render: (args) => (
    <div className="flex w-80 flex-col gap-1.5">
      <Label htmlFor="notes-invalid">Visit notes</Label>
      <Textarea {...args} id="notes-invalid" />
      <span className="text-xs text-danger">This field is required.</span>
    </div>
  ),
};
