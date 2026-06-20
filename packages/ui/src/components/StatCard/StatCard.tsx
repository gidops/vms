import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import { Card } from "../Card/Card";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Small caption under the value (e.g. "overdue today"). */
  hint?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-muted">{label}</span>
          <span className="text-3xl font-semibold text-fg">{value}</span>
          {hint ? <span className="text-xs text-fg-subtle">{hint}</span> : null}
        </div>
        {Icon ? (
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary-subtle text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
