import { Check } from "lucide-react";
import { cn } from "../../foundations/cn";

export type TimelineStepState = "complete" | "current" | "upcoming";

export interface TimelineStep {
  key: string;
  label: string;
  description?: string;
  state: TimelineStepState;
}

export interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

/**
 * Vertical status stepper used for the visit lifecycle
 * (Invite Created → Awaiting Approval → Checked In → Pass Issued → Checked Out).
 * Generic over steps so it isn't coupled to a specific status enum; callers map
 * their domain status (e.g. contracts `VISIT_LIFECYCLE`) into steps + state.
 */
export function Timeline({ steps, className }: TimelineProps) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? (
              <span
                className="absolute start-3 top-6 h-[calc(100%-1.5rem)] w-px -translate-x-1/2 bg-border rtl:translate-x-1/2"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                step.state === "complete" &&
                  "border-success bg-success text-success-fg",
                step.state === "current" &&
                  "border-primary bg-surface text-primary",
                step.state === "upcoming" &&
                  "border-border bg-surface text-fg-subtle",
              )}
            >
              {step.state === "complete" ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <span className="size-2 rounded-full bg-current" />
              )}
            </span>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <span
                className={cn(
                  "text-sm font-medium",
                  step.state === "upcoming" ? "text-fg-muted" : "text-fg",
                )}
              >
                {step.label}
              </span>
              {step.description ? (
                <span className="text-xs text-fg-muted">
                  {step.description}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
