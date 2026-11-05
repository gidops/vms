import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../primitives/Button/Button";
import { Input } from "../../primitives/Input/Input";
import { Label } from "../../primitives/Label/Label";
import { AuthLayout } from "./AuthLayout";

const meta = {
  title: "Patterns/AuthLayout",
  component: AuthLayout,
  parameters: { layout: "fullscreen" },
  args: {
    heroSrc: "",
    heroTitle: "Abuja-AATC",
    heroSubtitle: "Visitor Management Portal",
    title: "Login",
    children: null,
  },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Login: Story = {
  render: (args) => (
    <AuthLayout {...args}>
      <form className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" />
        </div>
        <Button type="submit" fullWidth>
          Login
        </Button>
      </form>
    </AuthLayout>
  ),
};
