import { ChevronRight, Flag, MessageSquareText, Users } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import { Badge } from "../../primitives/Badge/index";

export type InboxCardType = "request" | "feedback" | "alert";

export interface InboxCardProps {
  type: InboxCardType;
  typeLabel: string;
  title: React.ReactNode;
  description: React.ReactNode;
  timeAgo: React.ReactNode;
  meta?: React.ReactNode;
  /** Unread items get a highlight that fades once read. */
  unread?: boolean;
  onClick?: () => void;
  className?: string;
}

const TYPE_META: Record<
  InboxCardType,
  { intent: "primary" | "warning" | "danger"; icon: typeof Users }
> = {
  request: { intent: "primary", icon: Users },
  feedback: { intent: "warning", icon: MessageSquareText },
  alert: { intent: "danger", icon: Flag },
};

export function InboxCard({
  type,
  typeLabel,
  title,
  description,
  timeAgo,
  meta,
  unread,
  onClick,
  className,
}: InboxCardProps) {
  const { intent, icon: Icon } = TYPE_META[type];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col gap-4 rounded-xl border p-5 pe-10 text-start shadow-xs transition-colors duration-500",
        unread
          ? "border-primary/30 bg-primary-subtle/50"
          : "border-border bg-surface",
        "hover:border-border-strong hover:bg-surface-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Badge intent={intent} tone="soft">
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
