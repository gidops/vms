import * as React from "react";
import { cn } from "../../foundations/cn";

export interface YesNoControlProps {
  /** `null` = not answered yet. There is deliberately no default answer. */
  value: boolean | null;
  onValueChange: (value: boolean) => void;
  /** Localised option labels. */
  yesLabel: string;
  noLabel: string;
  /** Unanswered after a submit attempt: red outline. */
  invalid?: boolean;
  disabled?: boolean;
  /** Stretch both options across the available width (phone layout). */
  fullWidth?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
}

/**
 * Required Yes/No answer as a two-option segmented control (a radiogroup).
 * Unlike SegmentedControl it starts with nothing selected, so a form can
 * insist on an explicit answer; the selected option fills with the brand
 * colour. Arrow keys move and select, as in a native radio group.
 */
export function YesNoControl({
  value,
  onValueChange,
  yesLabel,
  noLabel,
  invalid = false,
  disabled = false,
  fullWidth = false,
  id,
  className,
  ...aria
}: YesNoControlProps) {
  const yesRef = React.useRef<HTMLButtonElement>(null);
  const noRef = React.useRef<HTMLButtonElement>(null);

  const options: { v: boolean; label: string; ref: typeof yesRef }[] = [
    { v: true, label: yesLabel, ref: yesRef },
    { v: false, label: noLabel, ref: noRef },
  ];

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      return;
    }
    e.preventDefault();
    const next = !(value ?? false);
    onValueChange(next);
    (next ? yesRef : noRef).current?.focus();
  };

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={aria["aria-label"]}
      aria-labelledby={aria["aria-labelledby"]}
      aria-describedby={aria["aria-describedby"]}
      aria-required="true"
      aria-invalid={invalid || undefined}
      className={cn(
        "items-center gap-1 rounded-full border bg-surface-muted p-1",
        fullWidth ? "flex w-full" : "inline-flex",
        invalid ? "border-danger" : "border-border",
        disabled && "opacity-60",
        className,
      )}
    >
      {options.map(({ v, label, ref }) => {
        const active = value === v;
        // Roving tab stop: the selected option, or "Yes" when unanswered.
        const tabbable = value === null ? v : active;
        return (
          <button
            key={String(v)}
            ref={ref}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={tabbable ? 0 : -1}
            disabled={disabled}
            onClick={() => onValueChange(v)}
            onKeyDown={onKeyDown}
            className={cn(
              "inline-flex min-w-20 items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              "disabled:cursor-not-allowed",
              fullWidth && "flex-1",
              active
                ? "bg-primary text-primary-fg shadow-xs"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
