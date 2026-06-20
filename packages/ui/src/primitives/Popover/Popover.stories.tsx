import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";

const meta = {
  title: "Primitives/Popover",
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button intent="neutral" tone="outline">
          Filters
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-fg">Filters</p>
          <p className="text-sm text-fg-muted">
            Filter controls would render here.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
