import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import { Card } from "../Card/Card";
import {
  statCardVariants,
  type StatCardVariantProps,
} from "./StatCard.variants";

export interface StatCardTrend {
  value: React.ReactNode;
  direction: "up" | "down";
  label?: string;
}

export interface StatCardProps extends StatCardVariantProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  /** Replaces `hint` when both are set. */
  trend?: StatCardTrend;
  action?: React.ReactNode;
  className?: string;
}

function Trend({ trend }: { trend: StatCardTrend }) {
  const Arrow = trend.direction === "up" ? ArrowUp : ArrowDown;
  return (
    <span className="flex items-center gap-1 text-xs text-fg-subtle">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-semibold",
          trend.direction === "up" ? "text-success" : "text-danger",
        )}
      >
        <Arrow className="size-3.5" aria-hidden="true" />
        {trend.value}
      </span>
      {trend.label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  action,
  layout,
  tone,
  className,
}: StatCardProps) {
  const s = statCardVariants({ layout, tone });
  const stacked = layout === "stacked";

  const iconChip = Icon ? (
    <div className={s.icon()}>
      <Icon className="size-5" aria-hidden="true" />
    </div>
  ) : null;

  const caption = trend ? (
    <Trend trend={trend} />
  ) : hint ? (
    <span className="text-xs text-fg-subtle">{hint}</span>
  ) : null;

  return (
    <Card className={cn(s.root(), className)}>
      <div className={s.body()}>
        {stacked ? (
          <div className="flex items-start justify-between gap-2">
            {iconChip}
            {action}
          </div>
        ) : null}
        <div className={s.text()}>
          <span className={s.label()}>{label}</span>
          <span className={s.value()}>{value}</span>
          {caption ? (
            <span className={stacked ? "pt-2" : undefined}>{caption}</span>
          ) : null}
        </div>
        {stacked ? null : iconChip}
      </div>
    </Card>
  );
}
