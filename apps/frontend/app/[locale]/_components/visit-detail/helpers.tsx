import type { TimelineStep } from "@vms/ui";
import * as React from "react";
import type { VisitRequestDetail } from "@/data/visits/visits.api";

export type VisitStatus = VisitRequestDetail["status"];

/** Terminal states — no further lifecycle actions apply. */
export const TERMINAL: VisitStatus[] = [
  "DENIED",
  "CANCELLED",
  "CHECKED_OUT",
  "EXPIRED",
];

/** Risk-level dot colours for the Alert Summary. */
export const LEVEL_DOT: Record<string, string> = {
  LOW: "bg-success",
  MEDIUM: "bg-warning",
  HIGH: "bg-danger",
  CRITICAL: "bg-danger",
};

/** Elapsed HH:MM:SS between two ISO timestamps, for the summary grid. */
export function durationHms(from: string, to: string): string {
  const secs = Math.max(
    0,
    Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 1000),
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(secs / 3600))}:${pad(
    Math.floor((secs % 3600) / 60),
  )}:${pad(secs % 60)}`;
}

/** A labelled field in a summary grid. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-fg-subtle">
        {label}
      </span>
      <span className="text-sm text-fg">{children}</span>
    </div>
  );
}

/** A labelled field on the emphasis (teal) Host/Unit/Floor card. */
export function Meta({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-emphasis-muted">
        {label}
      </span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

/**
 * Derive the visit-progress steps from a visit. VMC/admin see the 5-step
 * "request status" (with the Invite Created origin); staff see the 4-step
 * "visit progress". Once on-site the stepper switches to the gate-validation
 * variant. `labels` maps step keys to translated text.
 */
export function timelineFor(
  status: VisitStatus,
  labels: Record<string, string>,
  variant: "staff" | "vmc",
): TimelineStep[] {
  const toSteps = (order: readonly string[], p: number): TimelineStep[] =>
    order.map((key, i) => ({
      key,
      label: labels[key] ?? key,
      state: i < p ? "complete" : i === p ? "current" : "upcoming",
    }));

  // On-site / checked-out: the gate-validation variant (both roles).
  if (status === "CHECKED_IN" || status === "CHECKED_OUT") {
    return toSteps(
      ["gateValidated", "checkedIn", "checkedOut"],
      status === "CHECKED_OUT" ? 3 : 2,
    );
  }

  const approved = status === "APPROVED";
  if (variant === "vmc") {
    return toSteps(
      ["inviteCreated", "awaitingSm", "checkedIn", "passIssued", "checkedOut"],
      approved ? 2 : 1,
    );
  }
  return toSteps(
    ["awaitingSm", "checkedIn", "passIssued", "checkedOut"],
    approved ? 1 : 0,
  );
}
