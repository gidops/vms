import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "../../foundations/cn";
import type { VariantProps } from "../../foundations/variants";
import { buttonVariants } from "./Button.variants";

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the single child element (Radix Slot) instead of a <button>. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      intent,
      tone,
      size,
      fullWidth,
      asChild = false,
      type,
      ...props
    },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({ intent, tone, size, fullWidth }),
          className,
        )}
        // `type` only applies to a real <button>; when asChild, the child owns it.
        type={asChild ? undefined : (type ?? "button")}
        {...props}
      />
    );
  },
);
