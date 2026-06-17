import * as React from "react";
import { cn } from "../../foundations/cn";

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  /** Accessible label announced to assistive tech. */
  label?: string;
}

export function Spinner({
  className,
  label = "Loading",
  ...props
}: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5 animate-spin text-current", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        strokeWidth="3"
        className="stroke-current opacity-25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-current"
      />
    </svg>
  );
}
