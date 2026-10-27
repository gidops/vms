import { cn } from "../../foundations/cn";

export interface BarChartPoint {
  /** Unique key (e.g. an ISO day); defaults to `label`. */
  key?: string;
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartPoint[];
  /** Accessible name for the chart (e.g. "Daily visitor volume, last 30 days"). */
  label: string;
  height?: number;
  /** Defaults to roughly eight labels across so 30 or 90 daily bars stay readable. */
  labelEvery?: number;
  tone?: "primary" | "success" | "danger";
  className?: string;
}

const TONE: Record<NonNullable<BarChartProps["tone"]>, string> = {
  primary: "bg-primary",
  success: "bg-success",
  danger: "bg-danger",
};

/** Bars are flex items, so the chart runs right-to-left in RTL with no mirroring. */
export function BarChart({
  data,
  label,
  height = 200,
  labelEvery,
  tone = "primary",
  className,
}: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="img"
        aria-label={label}
        className="flex items-end gap-[2px] border-b border-border"
        style={{ height }}
      >
        {data.map((d) => (
          <div
            key={d.key ?? d.label}
            title={`${d.label}: ${d.value}`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <div
              className={cn(
                "w-full rounded-t-sm transition-opacity hover:opacity-80",
                d.value > 0 ? TONE[tone] : "bg-border",
              )}
              style={{
                height: d.value > 0 ? `${(d.value / max) * 100}%` : 2,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] text-xs text-fg-muted" aria-hidden="true">
        {data.map((d, i) => (
          <span
            key={d.key ?? d.label}
            className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap"
          >
            {i % every === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.key ?? d.label}>
            {d.label}: {d.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
