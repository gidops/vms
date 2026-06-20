import * as React from "react";
import { cn } from "../../foundations/cn";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/** Placeholder block for loading states. Compose with width/height utilities. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
      {...props}
    />
  );
}
