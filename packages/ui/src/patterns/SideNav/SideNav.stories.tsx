import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ChartColumn,
  ClipboardCheck,
  LayoutGrid,
  MapPin,
  Puzzle,
  Settings,
  ShieldAlert,
  Tags,
  UserCog,
  Users,
} from "lucide-react";
import * as React from "react";
import { SideNav, type SideNavItem } from "./SideNav";

const items: SideNavItem[] = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutGrid,
    href: "#",
    active: true,
  },
  { key: "visitors", label: "Visitors", icon: Users, href: "#" },
  {
    key: "requests",
    label: "Requests & Approvals",
    icon: ClipboardCheck,
    href: "#",
  },
  { key: "watchlist", label: "Watchlist", icon: ShieldAlert, href: "#" },
  { key: "users", label: "Users & Staff Roles", icon: UserCog, href: "#" },
  {
    key: "floors",
    label: "Floors & Locations",
    icon: MapPin,
    disabled: true,
    disabledHint: "Coming soon",
  },
  { key: "categories", label: "Visit Categories", icon: Tags, href: "#" },
  {
    key: "analytics",
    label: "Analytics & Reports",
    icon: ChartColumn,
    href: "#",
  },
  { key: "integrations", label: "Integrations", icon: Puzzle, href: "#" },
  { key: "settings", label: "Settings", icon: Settings, href: "#" },
];

const meta = {
  title: "Patterns/SideNav",
  component: SideNav,
  args: {
    items,
    label: "Admin sections",
    collapseLabel: "Collapse sidebar",
    expandLabel: "Expand sidebar",
  },
  argTypes: { collapsed: { control: "boolean" } },
  decorators: [
    (Story) => (
      <div className="h-[36rem] bg-canvas">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SideNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: function Render(args) {
    const [collapsed, setCollapsed] = React.useState(args.collapsed ?? false);
    return (
      <SideNav
        {...args}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
    );
  },
};

export const Collapsed: Story = {
  args: { collapsed: true },
};

/** No collapse labels → no toggle; disabled items stay visible but inert. */
export const Static: Story = {
  args: { collapseLabel: undefined, expandLabel: undefined },
};
