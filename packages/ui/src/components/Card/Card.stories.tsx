import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../primitives/Button/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./Card";

const meta = {
  title: "Components/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Visit Request</CardTitle>
        <CardDescription>Awaiting CSO approval</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-fg-muted">
        Judith Francis · 12th floor · 2 Mar, 9:42 AM
      </CardContent>
      <CardFooter>
        <Button intent="neutral" tone="outline" size="sm">
          View
        </Button>
        <Button size="sm">Approve</Button>
      </CardFooter>
    </Card>
  ),
};
