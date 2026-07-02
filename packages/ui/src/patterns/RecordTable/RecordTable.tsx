import * as React from "react";
import { cn } from "../../foundations/cn";

export interface RecordTableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Filter/search row above the table. */
  toolbar?: React.ReactNode;
  /** Pagination row below the table. */
  pagination?: React.ReactNode;
  /** Shown in place of the table body area when there are no records. */
  isEmpty?: boolean;
  emptyState?: React.ReactNode;
  /**
   * Drop the surrounding border + rounded corners so the table reads as a
   * borderless surface (e.g. the striped staff "Recent Guest" table).
   */
  flush?: boolean;
  /** The <Table> (or a loading skeleton). */
  children: React.ReactNode;
}

/**
 * Composes FilterBar + Table + Pagination + EmptyState into the standard
 * records surface (Dashboard "Visitor Records", inbox lists, etc.).
 */
export function RecordTable({
  toolbar,
  pagination,
  isEmpty,
  emptyState,
  flush,
  className,
  children,
  ...props
}: RecordTableProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      {toolbar}
      <div
        className={cn(
          "overflow-hidden bg-surface",
          !flush && "rounded-lg border border-border",
        )}
      >
        {isEmpty ? <div className="p-6">{emptyState}</div> : children}
      </div>
      {pagination && !isEmpty ? (
        <div className="flex justify-end">{pagination}</div>
      ) : null}
    </div>
  );
}
