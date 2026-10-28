import * as React from "react";
import { cn } from "../../foundations/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Marks the field invalid (sets aria-invalid and danger styling). */
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, rows, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows ?? 3}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg",
          "placeholder:text-fg-subtle",
          // Focus shows as a coloured border, not a ring around the field.
          "transition-colors focus:border-[var(--color-ring)] focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:border-danger",
          className,
        )}
        {...props}
      />
    );
  },
);
