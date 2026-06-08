import * as React from "react";
import { cn } from "../../foundations/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Marks the field invalid (sets aria-invalid and danger styling). */
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, invalid, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type ?? "text"}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg",
          "placeholder:text-fg-subtle",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
          "focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-canvas)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger",
          className,
        )}
        {...props}
      />
    );
  },
);
