"use client";

import { cn } from "@vms/ui";

export const filterPill =
  "rounded-full border bg-surface px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

export const filterPillState = (active: boolean) =>
  active
    ? "border-primary text-primary"
    : "border-border text-fg-muted hover:text-fg";

/** Pills keep one row on small screens and scroll sideways; they wrap from `md` up. */
export const SCROLLING_PILLS =
  "max-w-full flex-nowrap overflow-x-auto md:flex-wrap md:overflow-visible";

/** Single-choice row of filter pills, rendered as a radiogroup. */
export function FilterPills<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...aria
}: {
  value: T;
  onValueChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  className?: string;
  "aria-label": string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(filterPill, filterPillState(value === option.value))}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
