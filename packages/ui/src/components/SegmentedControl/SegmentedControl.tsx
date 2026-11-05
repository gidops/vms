import * as React from "react";
import { cn } from "../../foundations/cn";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  count?: number;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  /** `null` = nothing chosen yet (a required question); `undefined` = uncontrolled. */
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** `onEmphasis` sits on the brand-green top nav; its active option gets a gold outline. */
  variant?: "default" | "onEmphasis";
  /** `primary` fills the chosen option with the brand colour, for form answers. */
  tone?: "neutral" | "primary";
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
}

const NEXT_KEYS = ["ArrowRight", "ArrowDown"];
const PREV_KEYS = ["ArrowLeft", "ArrowUp"];

/**
 * Pill-group toggle, rendered as a radiogroup with one tab stop. Arrow keys
 * move between options; they also select once something is chosen, but never
 * pick an answer on their own while the question is unanswered.
 */
export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  variant = "default",
  tone = "neutral",
  invalid = false,
  disabled = false,
  required = false,
  fullWidth = false,
  id,
  className,
  ...aria
}: SegmentedControlProps) {
  const [internal, setInternal] = React.useState(
    defaultValue ?? options[0]?.value,
  );
  const selected = value === undefined ? internal : value;
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const select = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = NEXT_KEYS.includes(e.key)
      ? 1
      : PREV_KEYS.includes(e.key)
        ? -1
        : 0;
    if (step === 0) return;
    e.preventDefault();
    // Arrow keys follow the reading direction, so mirror them in RTL.
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
    const delta = rtl && horizontal ? -step : step;
    const next = (index + delta + options.length) % options.length;
    refs.current[next]?.focus();
    const target = options[next];
    if (target && selected !== null && selected !== undefined) {
      select(target.value);
    }
  };

  const onEmphasis = variant === "onEmphasis";
  const primary = tone === "primary";
  const tabStop = options.some((o) => o.value === selected)
    ? selected
    : options[0]?.value;

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={aria["aria-label"]}
      aria-labelledby={aria["aria-labelledby"]}
      aria-describedby={aria["aria-describedby"]}
      aria-required={required || undefined}
      aria-invalid={invalid || undefined}
      className={cn(
        "items-center gap-1 rounded-full p-1",
        fullWidth ? "flex w-full" : "inline-flex",
        onEmphasis
          ? "border border-emphasis-border bg-white/5"
          : cn(
              "border bg-surface-muted",
              invalid ? "border-danger" : "border-border",
            ),
        disabled && "opacity-60",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === selected;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={option.value === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => select(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full text-sm whitespace-nowrap transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              "disabled:cursor-not-allowed",
              primary
                ? "min-w-20 px-5 py-2 font-semibold"
                : "px-4 py-1.5 font-medium",
              fullWidth && "flex-1",
              onEmphasis
                ? active
                  ? "border-2 border-accent text-emphasis-fg"
                  : "border-2 border-transparent text-emphasis-fg/70 hover:text-emphasis-fg"
                : active
                  ? primary
                    ? "bg-primary text-primary-fg shadow-xs"
                    : "bg-surface text-fg shadow-xs"
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
