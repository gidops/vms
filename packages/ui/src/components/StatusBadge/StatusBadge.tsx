import type { VisitStatus } from "@vms/contracts";
import { cn } from "../../foundations/cn";
import { Badge, type BadgeProps } from "../../primitives/Badge/index";

type Intent = NonNullable<BadgeProps["intent"]>;

/**
 * Maps the shared `VisitStatus` lifecycle (from @vms/contracts) to a badge
 * intent + human label. Because the status union comes from the contracts
 * package, the UI can never render a status the backend doesn't define.
 */
const STATUS_MAP: Record<VisitStatus, { intent: Intent; label: string }> = {
  PENDING: { intent: "warning", label: "Awaiting Approval" },
  // The CSO bounced the request back to the host for more detail.
  NEEDS_MORE_INFO: { intent: "danger", label: "Needs More Info" },
  // An approved, not-yet-arrived visit is shown to gate staff as "Expected".
  APPROVED: { intent: "info", label: "Expected" },
  DENIED: { intent: "danger", label: "Denied" },
  // A checked-in visitor is physically on site.
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
  // Design status pills are a neutral grey pill (badge-neutral fill/border) with
  // the status colour carried by the text only, and no leading dot. `soft` keeps
  // the intent-coloured text; the className overrides the tinted fill to neutral.
  return (
    <Badge
      intent={intent}
      tone="soft"
      dot={dot}
      className={cn(
        "border-badge-neutral-border bg-badge-neutral text-[13px]",
        className,
      )}
      {...props}
    >
      {label}
    </Badge>
  );
}
