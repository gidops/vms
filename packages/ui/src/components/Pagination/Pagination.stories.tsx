import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { Pagination } from "./Pagination";

const meta = {
  title: "Components/Pagination",
  component: Pagination,
  args: { page: 1, totalPages: 10, onPageChange: () => {} },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

function PaginationDemo({ totalPages }: { totalPages: number }) {
  const [page, setPage] = React.useState(1);
  return (
    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
  );
}

export const Default: Story = {
  render: () => <PaginationDemo totalPages={10} />,
};

export const FewPages: Story = {
  render: () => <PaginationDemo totalPages={4} />,
};
