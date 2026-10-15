import { Slot, Slottable } from "@radix-ui/react-slot";
import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import {
  actionTileVariants,
  type ActionTileVariantProps,
} from "./ActionTile.variants";

export interface ActionTileProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    ActionTileVariantProps {
  icon: LucideIcon;
  /** Render the child element (e.g. a link) with the tile's styling. */
  asChild?: boolean;
}

export const ActionTile = React.forwardRef<HTMLButtonElement, ActionTileProps>(
  function ActionTile(
    { icon: Icon, intent, asChild, className, children, type, ...props },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(actionTileVariants({ intent }), className)}
        {...props}
      >
        <Icon className="size-6" aria-hidden="true" />
        <Slottable>{children}</Slottable>
      </Comp>
    );
  },
);
