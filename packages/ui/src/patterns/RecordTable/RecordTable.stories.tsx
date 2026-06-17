import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox } from "lucide-react";
import * as React from "react";
import { Button } from "../../primitives/Button/Button";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { Pagination } from "../../components/Pagination/Pagination";
import { SearchInput } from "../../components/SearchInput/SearchInput";
import { StatusBadge } from "../../components/StatusBadge/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/Table/Table";
import { FilterBar } from "../FilterBar/FilterBar";
import { RecordTable } from "./RecordTable";

const meta = {
  title: "Patterns/RecordTable",
  component: RecordTable,
  args: { children: null },
} satisfies Meta<typeof RecordTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const ROWS = [
  {
    name: "Judith Francis",
    purpose: "Account review",
    status: "CHECKED_IN" as const,
  },
  {
    name: "Amaka Obi",
    purpose: "Contract signing",
    status: "PENDING" as const,
  },
  {
    name: "Tunde Bello",
    purpose: "Maintenance",
    status: "CHECKED_OUT" as const,
  },
];

function RecordTableDemo() {
  const [page, setPage] = React.useState(1);
  return (
    <div className="w-[44rem]">
      <RecordTable
        toolbar={
          <FilterBar actions={<Button size="sm">Search</Button>}>
            <div className="min-w-56 flex-1">
              <SearchInput placeholder="Search visitor records" />
            </div>
          </FilterBar>
        }
        pagination={
          <Pagination page={page} totalPages={6} onPageChange={setPage} />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Visitor</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-fg-muted">{row.purpose}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </RecordTable>
    </div>
  );
}

export const Default: Story = {
  render: () => <RecordTableDemo />,
};

export const Empty: Story = {
  render: () => (
    <div className="w-[44rem]">
      <RecordTable
        isEmpty
        emptyState={
          <EmptyState
            icon={Inbox}
            title="No records found"
            description="Try adjusting your search or filters."
          />
        }
      >
        <div />
      </RecordTable>
    </div>
  ),
};
