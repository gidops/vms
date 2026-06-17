import * as React from "react";
import { cn } from "../../foundations/cn";
import type { VariantProps } from "../../foundations/variants";
import { badgeVariants } from "./Badge.variants";

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Render a leading status dot in the current color. */
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge(
    { className, intent, tone, size, dot, children, ...props },
    ref,
  ) {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ intent, tone, size }), className)}
        {...props}
      >
        {dot ? (
          <span
            className="size-1.5 rounded-full bg-current"
            aria-hidden="true"
          />
        ) : null}
        {children}
      </span>
    );
  },
);
