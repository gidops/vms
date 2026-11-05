import type { VisitStatus } from "@vms/contracts";
import { cn } from "../../foundations/cn";
import { Badge, type BadgeProps } from "../../primitives/Badge/index";

type Intent = NonNullable<BadgeProps["intent"]>;

/** Keyed by the contracts' `VisitStatus`, so the UI can't render a status the backend doesn't define. */
const STATUS_MAP: Record<VisitStatus, { intent: Intent; label: string }> = {
  PENDING: { intent: "warning", label: "Awaiting Approval" },
  REVIEW_REQUESTED: { intent: "danger", label: "Review Requested" },
  FLAGGED: { intent: "danger", label: "Flagged" },
  // Gate staff see an approved, not-yet-arrived visit as "Expected".
  APPROVED: { intent: "info", label: "Expected" },
  DENIED: { intent: "danger", label: "Denied" },
  CHECKED_IN: { intent: "success", label: "Onsite" },
  CHECKED_OUT: { intent: "neutral", label: "Checked Out" },
  CANCELLED: { intent: "warning", label: "Cancelled" },
  EXPIRED: { intent: "neutral", label: "Expired" },
};

export interface StatusBadgeProps extends Omit<
  BadgeProps,
  "intent" | "children"
> {
  status: VisitStatus;
}

export function StatusBadge({
  status,
  dot = false,
  className,
  ...props
}: StatusBadgeProps) {
  const { intent, label } = STATUS_MAP[status];
  return (
    <Badge
      intent={intent}
      dot={dot}
      className={cn("border-current/15", className)}
      {...props}
    >
      {label}
    </Badge>
  );
}
