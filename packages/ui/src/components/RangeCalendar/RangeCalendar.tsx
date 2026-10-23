import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  RangeCalendar as AriaRangeCalendar,
  type RangeCalendarProps as AriaRangeCalendarProps,
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  type DateValue,
  Heading,
} from "react-aria-components";
import { cn } from "../../foundations/cn";

export interface RangeCalendarProps<
  T extends DateValue,
> extends AriaRangeCalendarProps<T> {
  className?: string;
}

const navButton =
  "inline-flex size-8 items-center justify-center rounded-md text-fg-muted outline-none transition-colors hover:bg-surface-muted disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

/**
 * Two-endpoint date-range picker built on react-aria-components' accessible
 * `RangeCalendar`, styled with VMS semantic tokens. Range ends get the solid
 * primary fill; the days between get the subtle primary tint. Values are
 * `@internationalized/date` objects (not JS `Date`) — convert at the boundary.
 */
export function RangeCalendar<T extends DateValue>({
  className,
  ...props
}: RangeCalendarProps<T>) {
  return (
    <AriaRangeCalendar
      {...props}
      className={cn("w-fit select-none text-fg", className)}
    >
      <header className="flex items-center justify-between pb-3">
        <Button slot="previous" className={navButton}>
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
        <Heading className="text-sm font-semibold text-fg" />
        <Button slot="next" className={navButton}>
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
      </header>
      <CalendarGrid className="border-separate border-spacing-1">
        <CalendarGridHeader>
          {(day) => (
            <CalendarHeaderCell className="pb-1 text-xs font-medium text-fg-subtle">
              {day}
            </CalendarHeaderCell>
          )}
        </CalendarGridHeader>
        <CalendarGridBody>
          {(date) => (
            <CalendarCell
              date={date}
              className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-md text-sm text-fg outline-none transition-colors",
                "data-[outside-month]:text-fg-subtle/50",
                "data-[hovered]:bg-primary-subtle",
                "data-[selected]:bg-primary-subtle data-[selected]:text-primary",
                "data-[selection-start]:bg-primary data-[selection-start]:text-primary-fg",
                "data-[selection-end]:bg-primary data-[selection-end]:text-primary-fg",
                "data-[disabled]:cursor-default data-[disabled]:text-fg-subtle/40 data-[disabled]:hover:bg-transparent",
                "data-[focus-visible]:ring-2 data-[focus-visible]:ring-[var(--color-ring)]",
              )}
            />
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </AriaRangeCalendar>
  );
}
