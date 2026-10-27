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

/** VMC/admin see the 5-step request status, staff the 4-step progress; on-site switches to gate validation. */
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
