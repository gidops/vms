import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { SearchInput } from "./SearchInput";

const meta = {
  title: "Components/SearchInput",
  component: SearchInput,
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function SearchDemo() {
  const [value, setValue] = React.useState("");
  return (
    <div className="w-80">
      <SearchInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClear={() => setValue("")}
        placeholder="Search visitor, host, floor, pass id"
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <SearchDemo />,
};
