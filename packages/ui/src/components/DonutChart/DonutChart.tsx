import * as React from "react";
import { cn } from "../../foundations/cn";

export type DonutTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  tone: DonutTone;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  /** Accessible name for the chart (e.g. "Visit status breakdown, today"). */
  label: string;
  /** Formats a 0–1 share for the legend; defaults to a rounded percentage. */
  formatShare?: (share: number) => string;
  /** Diameter of the ring in px. */
  size?: number;
  className?: string;
}

/** Semantic token per tone — kept here so the ring and legend dots match. */
const TONE_COLOR: Record<DonutTone, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
  neutral: "var(--color-border)",
};

const defaultFormat = (share: number) => `${Math.round(share * 100)}%`;

/**
 * Ring chart with a legend (dot · label · share). Segments are drawn clockwise
 * from 12 o'clock with stroke-dash arcs; an all-zero dataset shows an empty
 * neutral ring rather than nothing.
 */
export function DonutChart({
  segments,
  label,
  formatShare = defaultFormat,
  size = 120,
  className,
}: DonutChartProps) {
  const stroke = size * 0.15;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let offset = 0;
  const arcs = segments.map((s) => {
    const length = total > 0 ? (s.value / total) * circumference : 0;
    const arc = { key: s.key, tone: s.tone, length, offset };
    offset += length;
    return arc;
  });

  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      <svg
        role="img"
        aria-label={label}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 rtl:scale-y-[-1]"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-muted)"
          strokeWidth={stroke}
        />
        {arcs.map((a) =>
          a.length > 0 ? (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={TONE_COLOR[a.tone]}
              strokeWidth={stroke}
              strokeDasharray={`${a.length} ${circumference - a.length}`}
              strokeDashoffset={-a.offset}
            />
          ) : null,
        )}
      </svg>
      <ul className="flex w-full flex-col gap-3 text-sm">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-3">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: TONE_COLOR[s.tone] }}
              aria-hidden="true"
            />
            <span className="flex-1 text-fg">{s.label}</span>
            <span className="font-medium tabular-nums text-fg">
              {formatShare(total > 0 ? s.value / total : 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
