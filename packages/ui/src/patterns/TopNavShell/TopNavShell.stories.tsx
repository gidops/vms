import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "../../primitives/Avatar/Avatar";
import { Button } from "../../primitives/Button/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/Select/Select";
import { SearchInput } from "../../components/SearchInput/SearchInput";
import { SegmentedControl } from "../../components/SegmentedControl/SegmentedControl";
import { FilterBar } from "../FilterBar/FilterBar";
import { TopNav } from "../TopNav/TopNav";
import { TopNavShell } from "./TopNavShell";

const meta = {
  title: "Patterns/TopNavShell",
  component: TopNavShell,
  parameters: { layout: "fullscreen" },
  args: { nav: null, children: null },
} satisfies Meta<typeof TopNavShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <TopNavShell
      nav={
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
          end={<Avatar name="Judith Francis" size="sm" />}
        />
      }
      filterBar={
        <FilterBar actions={<Button>Search</Button>}>
          <div className="min-w-56 flex-1">
            <SearchInput placeholder="Search visitor, host, floor, pass id" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
      }
    >
      <div className="text-fg-muted">Main content area</div>
    </TopNavShell>
  ),
};
