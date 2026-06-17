import * as React from "react";
import { cn } from "../../foundations/cn";

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Trailing actions (e.g. a Search button or "Clear filters"). */
  actions?: React.ReactNode;
}

/**
 * Layout container for the search + filter row seen across the VMC screens.
 * Children (SearchInput, Selects) flow in a wrapping row; `actions` are pinned
 * to the trailing edge.
 */
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
