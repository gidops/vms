import * as React from "react";
import { cn } from "../../foundations/cn";

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode;
}

export function FilterBar({
  actions,
  className,
  children,
  ...props
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center",
        className,
      )}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
