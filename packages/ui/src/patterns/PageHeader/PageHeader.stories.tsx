import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../primitives/Button/Button";
import { PageHeader } from "./PageHeader";

const meta = {
  title: "Patterns/PageHeader",
  component: PageHeader,
  args: { title: "Requests & Alerts" },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[48rem]">
      <PageHeader
        {...args}
        breadcrumbs={[
          { label: "Dashboard", href: "#" },
          { label: "Requests & Alerts" },
        ]}
        description="Review visit requests and security alerts."
        actions={
          <>
            <Button intent="neutral" tone="outline">
              Export
            </Button>
            <Button>Create visit</Button>
          </>
        }
      />
    </div>
  ),
};
