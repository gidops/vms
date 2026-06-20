import * as React from "react";
import { cn } from "../../foundations/cn";

export interface StatStripItem {
  label: string;
  value: React.ReactNode;
}

export interface StatStripProps extends React.HTMLAttributes<HTMLDivElement> {
  items: StatStripItem[];
}

/**
 * A single bordered surface split into stat cells separated by vertical
 * dividers (e.g. Onsite / Checked-in / Checked-out). Distinct from `StatCard`,
 * which renders standalone cards. Cells stack on small screens.
 */
export function StatStrip({ items, className, ...props }: StatStripProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-surface shadow-xs",
        "divide-y divide-border sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0",
        "rtl:sm:divide-x-reverse",
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-2 p-5">
          <span className="text-sm text-fg-muted">{item.label}</span>
          <span className="text-3xl font-semibold text-fg">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
