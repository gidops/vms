import * as React from "react";
import { cn } from "../../foundations/cn";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  count?: number;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** `onEmphasis` sits on the brand-green top nav; its active option gets a gold outline. */
  variant?: "default" | "onEmphasis";
  "aria-label"?: string;
  className?: string;
}

/** Pill-group toggle, rendered as a radiogroup; controlled or uncontrolled. */
export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  variant = "default",
  className,
  ...props
}: SegmentedControlProps) {
  const [internal, setInternal] = React.useState(
    defaultValue ?? options[0]?.value,
  );
  const selected = value ?? internal;

  const select = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  const onEmphasis = variant === "onEmphasis";

  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"]}
      className={cn(
        "inline-flex items-center gap-1 rounded-full p-1",
        onEmphasis
          ? "border border-emphasis-border bg-white/5"
          : "border border-border bg-surface-muted",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => select(option.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              onEmphasis
                ? active
                  ? "border border-accent text-emphasis-fg"
                  : "border border-transparent text-emphasis-fg/70 hover:text-emphasis-fg"
                : active
                  ? "bg-surface text-fg shadow-xs"
                  : "border border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                  onEmphasis ? "bg-white text-emphasis" : "bg-fg text-surface",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
