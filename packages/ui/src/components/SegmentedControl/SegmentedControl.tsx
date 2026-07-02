import * as React from "react";
import { cn } from "../../foundations/cn";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  /** Optional trailing count pill (e.g. "Requests & Alerts" → 8). */
  count?: number;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  /** Controlled selected value. */
  value?: string;
  /** Uncontrolled initial value (defaults to the first option). */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * `default` — light surface, sliding active pill inside a shared grey track.
   * `onEmphasis` — sits on a deep brand-green surface (the top nav), active
   * option gets a gold outline.
   * `outline` — standalone pills (no shared track background); the active
   * option gets a thicker primary-colored border instead of a filled
   * background (the staff dashboard's "Today / Last 7 days / Custom" toggle).
   */
  variant?: "default" | "onEmphasis" | "outline";
  "aria-label"?: string;
  className?: string;
}

/**
 * Pill-group toggle used in the top nav ("Today's Schedule" / "Requests &
 * Alerts") and above the records table ("Today" / "Last 7 days" / "Custom").
 * Works controlled or uncontrolled. Rendered as a radiogroup for a11y.
 */
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
  const outline = variant === "outline";

  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"]}
      className={cn(
        "inline-flex items-center",
        outline
          ? "gap-2"
          : cn(
              "gap-1 rounded-full p-1",
              onEmphasis
                ? "border border-emphasis-border bg-white/5"
                : "border border-border bg-surface-muted",
            ),
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
              "inline-flex items-center gap-2 whitespace-nowrap transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              outline
                ? cn(
                    "h-[35px] rounded-full bg-surface text-base",
                    active
                      ? "border-2 border-primary px-6 font-semibold text-primary"
                      : "border border-border px-3 font-medium text-fg-subtle hover:text-primary",
                  )
                : cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium",
                    onEmphasis
                      ? active
                        ? "border border-accent text-emphasis-fg"
                        : "border border-transparent text-emphasis-fg/70 hover:text-emphasis-fg"
                      : active
                        ? "bg-surface text-fg shadow-xs"
                        : "border border-transparent text-fg-muted hover:text-fg",
                  ),
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
