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
   * Drop the surrounding card (border/radius/background) so the table sits flush
   * on the page. The `Table` primitive keeps its own horizontal scroll.
   */
  frameless?: boolean;
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
  frameless,
  className,
  children,
  ...props
}: RecordTableProps) {
  const body = isEmpty ? (
    <div className={frameless ? "py-6" : "p-6"}>{emptyState}</div>
  ) : (
    children
  );
  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      {toolbar}
      {frameless ? (
        body
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {body}
        </div>
      )}
      {pagination && !isEmpty ? (
        <div className="flex justify-center">{pagination}</div>
      ) : null}
    </div>
  );
}
