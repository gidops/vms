"use client";

import * as React from "react";

export interface StepperProps {
  steps: string[];
  /** Zero-based index of the active step. */
  current: number;
}

/**
 * Horizontal pill stepper shown in the dark-green sheet header. The active and
 * completed steps are highlighted (accent), upcoming steps are muted. Connectors
 * fill in as you progress.
 */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center justify-center gap-1">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const reached = done || active;
        return (
          <React.Fragment key={label}>
            {i > 0 ? (
              <li
                aria-hidden="true"
                className={
                  "h-px w-6 shrink-0 sm:w-10 " +
                  (done ? "bg-accent" : "bg-emphasis-fg/30")
                }
              />
            ) : null}
            <li
              aria-current={active ? "step" : undefined}
              className={
                "rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap " +
                (reached
                  ? "border-accent text-accent"
                  : "border-emphasis-fg/30 text-emphasis-fg/70")
              }
            >
              {label}
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}
