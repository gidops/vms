import { ListFilterPlus } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../primitives/Popover/Popover";

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Leading search field; stays inline on every screen size. */
  search?: React.ReactNode;
  /** Trailing buttons, from md up (small screens search on Enter / as you type). */
  actions?: React.ReactNode;
  /** Accessible name for the small-screen button that opens the filters. */
  filtersLabel?: string;
}

/**
 * Search, filters and actions in one row from md up. On small screens the
 * filters (`children`) collapse behind an icon button beside the search.
 */
export function FilterBar({
  search,
  actions,
  filtersLabel = "Filters",
  className,
  children,
  ...props
}: FilterBarProps) {
  const hasFilters = React.Children.toArray(children).length > 0;
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-wrap">
        {search ? (
          <div className="min-w-0 flex-1 md:min-w-56">{search}</div>
        ) : null}
        {hasFilters ? (
          <>
            <div className="hidden md:contents">{children}</div>
            <Popover>
              <PopoverTrigger
                aria-label={filtersLabel}
                className={cn(
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-fg transition-colors outline-none md:hidden",
                  "hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                  "data-[state=open]:bg-surface-muted",
                )}
              >
                <ListFilterPlus className="size-5" aria-hidden="true" />
              </PopoverTrigger>
              {/* Stacked full-width: each filter's own fixed width is for the desktop row. */}
              <PopoverContent
                align="end"
                className="flex w-64 flex-col gap-2 p-3 *:w-full"
              >
                {children}
              </PopoverContent>
            </Popover>
          </>
        ) : null}
      </div>
      {actions ? (
        <div className="hidden items-center gap-2 md:flex">{actions}</div>
      ) : null}
    </div>
  );
}
