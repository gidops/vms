import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, ChevronDown } from "lucide-react";
import { Avatar } from "../../primitives/Avatar/Avatar";
import { Badge } from "../../primitives/Badge/Badge";
import { Button } from "../../primitives/Button/Button";
import { SegmentedControl } from "../../components/SegmentedControl/SegmentedControl";
import { TopNav } from "./TopNav";

const meta = {
  title: "Patterns/TopNav",
  component: TopNav,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TopNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <TopNav
      brand={
        <span className="text-lg font-bold tracking-wide">AFREXIMBANK</span>
      }
      center={
        <SegmentedControl
          variant="onEmphasis"
          aria-label="Workspace view"
          defaultValue="schedule"
          options={[
            { value: "schedule", label: "Today's Schedule" },
            { value: "requests", label: "Requests & Alerts", count: 8 },
          ]}
        />
      }
      end={
        <>
          <Button
            intent="neutral"
            tone="ghost"
            size="sm"
            aria-label="Notifications"
            className="text-emphasis-fg hover:bg-white/10"
          >
            <span className="relative">
              <Bell className="size-5" aria-hidden="true" />
              <Badge
                intent="accent"
                tone="solid"
                size="sm"
                className="absolute -end-2 -top-2 size-4 justify-center p-0"
              >
                3
              </Badge>
            </span>
          </Button>
          <Avatar name="Judith Francis" size="sm" />
          <ChevronDown className="size-4" aria-hidden="true" />
        </>
      }
    />
  ),
};
