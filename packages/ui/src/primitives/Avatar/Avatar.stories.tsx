import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./Avatar";

const meta = {
  title: "Primitives/Avatar",
  component: Avatar,
  args: { name: "Judith Francis" },
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ColorCoded: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      {[
        "Judith Francis",
        "Amaka Obi",
        "Tunde Bello",
        "Sarah Khan",
        "David Okoro",
        "Mei Lin",
      ].map((name) => (
        <Avatar key={name} name={name} />
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} size="sm" />
      <Avatar {...args} size="md" />
      <Avatar {...args} size="lg" />
    </div>
  ),
};
