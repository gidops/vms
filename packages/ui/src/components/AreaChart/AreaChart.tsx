import * as React from "react";
import { cn } from "../../foundations/cn";

export interface AreaChartPoint {
  /** X-axis tick label (e.g. "08" for 08:00). */
  label: string;
  value: number;
}

export interface AreaChartProps {
  data: AreaChartPoint[];
  /** Accessible name for the chart image (e.g. "Check-ins per hour, today"). */
  label: string;
  /** Plot height in px (excluding the x-axis labels). */
  height?: number;
  /** Number of horizontal grid lines. */
  gridLines?: number;
  className?: string;
}

const PAD_Y = 8;
const DOT_R = 5;

/**
 * Smooth (Catmull-Rom) path through the points. Control points are clamped to
 * the plot so the curve never overshoots below zero or above the max.
 */
function smoothPath(
  pts: { x: number; y: number }[],
  minY: number,
  maxY: number,
) {
  const first = pts[0];
  if (!first) return "";
  const clamp = (v: number) => Math.min(maxY, Math.max(minY, v));
  let d = `M${first.x},${first.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6);
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Tracks an element's content width so the SVG can draw in real pixels. */
function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Single-series line chart on a soft gradient plot background, with
 * horizontal grid lines and x-axis labels. Coloured from semantic tokens
 * (`primary` line, `success` tint) so it follows the theme. The values are also
 * exposed as a visually hidden list for screen readers.
 */
export function AreaChart({
  data,
  label,
  height = 200,
  gridLines = 4,
  className,
}: AreaChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gradientId = React.useId();

  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = Math.max(0, width - DOT_R * 2);
  const plotTop = PAD_Y;
  const plotBottom = height - PAD_Y;
  const pts = data.map((d, i) => ({
    label: d.label,
    x:
      DOT_R + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2),
    y: plotBottom - (d.value / max) * (plotBottom - plotTop),
  }));
  const line = smoothPath(pts, plotTop, plotBottom);

  return (
    <div className={cn("relative flex flex-col gap-3", className)}>
      <div ref={ref} className="w-full" style={{ height }}>
        {width > 0 ? (
          <svg
            role="img"
            aria-label={label}
            width={width}
            height={height}
            // Mirror in RTL so time runs the same way as the (flex) axis labels.
            className="block overflow-visible rtl:-scale-x-100"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-success)"
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-success)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <rect
              x={DOT_R}
              y={0}
              width={innerW}
              height={height}
              fill={`url(#${gradientId})`}
            />
            {Array.from({ length: gridLines }, (_, i) => {
              const y =
                plotTop + ((i + 1) / (gridLines + 1)) * (plotBottom - plotTop);
              return (
                <line
                  key={i}
                  x1={DOT_R}
                  x2={DOT_R + innerW}
                  y1={y}
                  y2={y}
                  stroke="var(--color-primary)"
                  strokeOpacity={0.15}
                />
              );
            })}
            <path
              d={line}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2}
              strokeLinecap="round"
            />
            {pts.map((p) => (
              <circle
                key={p.label}
                cx={p.x}
                cy={p.y}
                r={DOT_R - 1}
                fill="var(--color-surface)"
                stroke="var(--color-primary)"
                strokeWidth={1.5}
              />
            ))}
          </svg>
        ) : null}
      </div>
      <div
        className="flex justify-between text-xs text-fg-muted"
        aria-hidden="true"
      >
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.label}>
            {d.label}: {d.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
