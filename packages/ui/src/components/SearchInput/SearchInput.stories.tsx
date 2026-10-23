import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { SearchInput } from "./SearchInput";

const meta = {
  title: "Components/SearchInput",
  component: SearchInput,
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function SearchDemo({ initial = "" }: { initial?: string }) {
  const [value, setValue] = React.useState(initial);
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

/** Filled in: one clear button only (the browser's own "x" is hidden). */
export const WithValue: Story = {
  render: () => <SearchDemo initial="Ifeoma" />,
};

/** Translucent field for the deep-green TopNav (global search). */
export const OnEmphasis: Story = {
  render: () => (
    <div className="w-[28rem] bg-emphasis p-4">
      <SearchInput
        variant="onEmphasis"
        placeholder="Search visitors, hosts, floors…"
      />
    </div>
  ),
};
