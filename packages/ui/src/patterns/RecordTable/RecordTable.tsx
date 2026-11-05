import * as React from "react";
import { cn } from "../../foundations/cn";

export interface RecordTableProps extends React.HTMLAttributes<HTMLDivElement> {
  toolbar?: React.ReactNode;
  pagination?: React.ReactNode;
  isEmpty?: boolean;
  emptyState?: React.ReactNode;
  /** Drop the surrounding card so the table sits flush on the page. */
  frameless?: boolean;
  children: React.ReactNode;
}

/** FilterBar + Table + Pagination + EmptyState as the standard records surface. */
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
