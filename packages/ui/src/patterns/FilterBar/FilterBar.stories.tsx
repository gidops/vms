import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../primitives/Button/Button";
import { Input } from "../../primitives/Input/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/Select/Select";
import { SearchInput } from "../../components/SearchInput/SearchInput";
import { FilterBar } from "./FilterBar";

const meta = {
  title: "Patterns/FilterBar",
  component: FilterBar,
} satisfies Meta<typeof FilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[48rem]">
      <FilterBar actions={<Button size="sm">Search</Button>}>
        <div className="min-w-56 flex-1">
          <SearchInput placeholder="Search visitor, host, floor, pass id" />
        </div>
        <Select defaultValue="status">
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">All Status</SelectItem>
            <SelectItem value="checked_in">Checked In</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="types">
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="types">All Visit types</SelectItem>
            <SelectItem value="walk_in">Walk-in</SelectItem>
            <SelectItem value="pre_invited">Pre-invited</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>
    </div>
  ),
};

/** Staff dashboard variant: a plain text `Input` plus three selects and a
 * standalone search action, rather than the `SearchInput` + trailing action. */
export const StaffSearch: Story = {
  render: () => (
    <div className="w-[54rem]">
      <FilterBar actions={<Button size="lg">Search</Button>}>
        <div className="min-w-56 flex-[2.2]">
          <Input placeholder="Search Guest, host, floor, pass id" />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="flex-[0.8]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Visit types</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Purpose</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>
    </div>
  ),
};
