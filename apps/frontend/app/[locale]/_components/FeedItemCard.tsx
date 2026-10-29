"use client";

import { ChevronRight } from "lucide-react";
import type * as React from "react";

/** A feed entry as a mobile card; the whole card opens it, the link text names where. */
export function FeedItemCard({
  badge,
  time,
  title,
  body,
  actionLabel,
  onOpen,
}: {
  badge: React.ReactNode;
  time: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  actionLabel: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-4 rounded-md border border-surface-muted bg-surface p-3 text-start shadow-xs outline-none transition-colors hover:bg-surface-muted/40 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      <span className="flex items-center justify-between gap-3">
        {badge}
        <span className="text-sm font-medium text-fg-subtle">{time}</span>
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="text-base font-semibold text-fg">{title}</span>
        {body ? <span className="text-sm text-fg-muted">{body}</span> : null}
      </span>
      <span className="flex items-center gap-1 self-end text-sm font-semibold text-primary">
        <span className="underline underline-offset-4">{actionLabel}</span>
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </span>
    </button>
  );
}
