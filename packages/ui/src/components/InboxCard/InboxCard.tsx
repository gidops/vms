import { ChevronRight, Flag, Users } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import { Badge } from "../../primitives/Badge/index";

export interface InboxCardProps {
  /** "request" tints the type pill teal (people icon); "alert" tints it red (flag). */
  type: "request" | "alert";
  /** Localised label for the type pill ("Visit Request" / "Alerts"). */
  typeLabel: string;
  title: React.ReactNode;
  description: React.ReactNode;
  /** Relative timestamp, e.g. "2 min ago". */
  timeAgo: React.ReactNode;
  /** Footer meta row (created-by, status pill, notes count). */
  meta?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * Inbox list card for the Requests & Alerts feed. Clickable surface that opens
 * the detail drawer; reuses `Badge` for the type pill and exposes a `meta` slot
 * for the footer (created-by / status / notes).
 */
export function InboxCard({
  type,
  typeLabel,
  title,
  description,
  timeAgo,
  meta,
  onClick,
  className,
}: InboxCardProps) {
  const Icon = type === "alert" ? Flag : Users;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col gap-4 rounded-xl border border-border bg-surface p-5 pe-10 text-start shadow-xs transition-colors",
        "hover:border-border-strong hover:bg-surface-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Badge intent={type === "alert" ? "danger" : "primary"} tone="soft">
          <Icon className="size-3.5" aria-hidden="true" />
          {typeLabel}
        </Badge>
        <span className="text-sm text-fg-subtle">{timeAgo}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        <p className="text-sm text-fg-muted">{description}</p>
      </div>

      {meta ? (
        <div className="flex flex-wrap items-center gap-2">{meta}</div>
      ) : null}

      <ChevronRight
        className="absolute end-3 top-1/2 size-5 -translate-y-1/2 text-fg-subtle rtl:rotate-180"
        aria-hidden="true"
      />
    </button>
  );
}
