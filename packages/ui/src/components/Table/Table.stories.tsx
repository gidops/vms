import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "../../primitives/Avatar/Avatar";
import { StatusBadge } from "../StatusBadge/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table";

const meta = {
  title: "Components/Table",
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const ROWS = [
  {
    name: "Judith Francis",
    host: "Finance · 12F",
    time: "9:42 AM",
    status: "CHECKED_IN" as const,
  },
  {
    name: "Amaka Obi",
    host: "Legal · 4F",
    time: "10:05 AM",
    status: "PENDING" as const,
  },
  {
    name: "Tunde Bello",
    host: "IT · 7F",
    time: "8:30 AM",
    status: "CHECKED_OUT" as const,
  },
  {
    name: "Sarah Khan",
    host: "HR · 2F",
    time: "11:15 AM",
    status: "DENIED" as const,
  },
];

export const VisitorRecords: Story = {
  render: () => (
    <div className="w-[40rem] rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Visitor</TableHead>
            <TableHead>Host / Floor</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row.name}>
              <TableCell>
                <span className="flex items-center gap-2">
                  <Avatar name={row.name} size="sm" />
                  <span className="font-medium">{row.name}</span>
                </span>
              </TableCell>
              <TableCell className="text-fg-muted">{row.host}</TableCell>
              <TableCell className="text-fg-muted">{row.time}</TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};
