import { getLocalTimeZone, today } from "@internationalized/date";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import type { DateValue, RangeValue } from "react-aria-components";
import { RangeCalendar } from "./RangeCalendar";

const meta = {
  title: "Components/RangeCalendar",
  component: RangeCalendar,
} satisfies Meta<typeof RangeCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

function RangeCalendarDemo() {
  const now = today(getLocalTimeZone());
  const [value, setValue] = React.useState<RangeValue<DateValue> | null>({
    start: now.subtract({ days: 4 }),
    end: now,
  });
  return (
    <RangeCalendar aria-label="Trip dates" value={value} onChange={setValue} />
  );
}

export const Default: Story = {
  render: () => <RangeCalendarDemo />,
};
