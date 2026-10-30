import * as React from "react";
import { cn } from "../../foundations/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Marks the field invalid (sets aria-invalid and danger styling). */
  invalid?: boolean;
  /** Decorative icon shown inside the field on the start side. */
  startIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, invalid, type, startIcon, ...props }, ref) {
    const field = (
      <input
        ref={ref}
        type={type ?? "text"}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg",
          "placeholder:text-fg-subtle",
          // Focus shows as a coloured border, not a ring around the field.
          "transition-colors focus:border-[var(--color-ring)] focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:border-danger",
          startIcon && "ps-9",
          className,
        )}
        {...props}
      />
    );
    if (!startIcon) return field;
    return (
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-fg-subtle [&>svg]:size-4"
        >
          {startIcon}
        </span>
        {field}
      </div>
    );
  },
);
