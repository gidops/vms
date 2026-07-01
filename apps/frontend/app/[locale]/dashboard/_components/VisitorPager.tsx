"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

export interface VisitorPagerProps {
  /** Number of visitors. */
  count: number;
  /** Zero-based index of the active visitor. */
  current: number;
  onSelect: (index: number) => void;
}

/**
 * Build the list of page tokens to render. Up to 5 visitors show every number;
 * beyond that it windows around the current one with "ellipsis" gaps, always
 * keeping the first and last — e.g. `1 … 4 [5] 6 … 12`.
 */
function pageTokens(count: number, current: number): (number | "ellipsis")[] {
  if (count <= 5) return Array.from({ length: count }, (_, i) => i);
  const keep = new Set(
    [0, count - 1, current - 1, current, current + 1].filter(
      (i) => i >= 0 && i < count,
    ),
  );
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = -1;
  for (const i of sorted) {
    if (i - prev > 1) out.push("ellipsis");
    out.push(i);
    prev = i;
  }
  return out;
}

/**
 * Visitor pager shown in the invite/walk-in form once a second visitor is added.
 * Active page = solid dark circle with a white number; the others are outlined
 * circles. Fades/slides in on mount.
 */
export function VisitorPager({ count, current, onSelect }: VisitorPagerProps) {
  // Start hidden, then flip on the next frame so the CSS transition plays on mount.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const tokens = pageTokens(count, current);

  return (
    <div
      className={
        "flex w-full items-center justify-between gap-3 transition-all duration-300 ease-out " +
        (mounted ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0")
      }
    >
      <button
        type="button"
        aria-label="Previous visitor"
        onClick={() => onSelect(Math.max(0, current - 1))}
        disabled={current === 0}
        className="text-fg-subtle transition-colors hover:text-fg disabled:opacity-30"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>

      <ol className="flex flex-1 items-center justify-center gap-2">
        {tokens.map((tok, i) =>
          tok === "ellipsis" ? (
            <li
              key={`gap-${i}`}
              aria-hidden="true"
              className="px-0.5 text-fg-subtle"
            >
              …
            </li>
          ) : (
            <li key={tok}>
              <button
                type="button"
                aria-label={`Visitor ${tok + 1}`}
                aria-current={tok === current ? "true" : undefined}
                onClick={() => onSelect(tok)}
                className={
                  "flex size-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors " +
                  (tok === current
                    ? "border-fg bg-fg text-surface"
                    : "border-border bg-surface text-fg-muted hover:border-fg/40")
                }
              >
                {tok + 1}
              </button>
            </li>
          ),
        )}
      </ol>

      <button
        type="button"
        aria-label="Next visitor"
        onClick={() => onSelect(Math.min(count - 1, current + 1))}
        disabled={current === count - 1}
        className="text-fg-subtle transition-colors hover:text-fg disabled:opacity-30"
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
