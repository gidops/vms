"use client";

import { cn } from "@vms/ui";
import { ChevronRight } from "lucide-react";
import type * as React from "react";

export interface RecordCardProps {
  /** Small green label in the card's top strip, e.g. how the guest came in. */
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Extra line under the subtitle, e.g. the RFID card badge. */
  extra?: React.ReactNode;
  /** Trailing the title, e.g. the status pill. */
  status?: React.ReactNode;
  /** Leading the grey footer, e.g. the guest count. */
  footer?: React.ReactNode;
  /** Trailing the grey footer: the row's one action. */
  action?: React.ReactNode;
  /** Tapping the body opens the record; the action keeps its own target. Omit for a card with nothing to open. */
  onOpen?: () => void;
  /** Accessible name for the body button, since its text alone is ambiguous. */
  openLabel?: string;
  className?: string;
}

const body = "flex w-full items-start justify-between gap-3 px-3 py-4";

/**
 * A table row as a card for small screens: everything a row shows at a glance,
 * the body opening the record and the footer holding the row action.
 */
export function RecordCard({
  eyebrow,
  title,
  subtitle,
  extra,
  status,
  footer,
  action,
  onOpen,
  openLabel,
  className,
}: RecordCardProps) {
  const content = (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-lg font-medium text-fg">{title}</span>
      {subtitle ? (
        <span className="truncate text-sm text-fg-muted">{subtitle}</span>
      ) : null}
      {extra ? (
        <span className="mt-1 flex flex-wrap gap-1">{extra}</span>
      ) : null}
    </span>
  );
  return (
    <article
      className={cn(
        "overflow-hidden rounded-md border border-surface-muted bg-surface shadow-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-surface-muted px-3 py-2 text-xs font-semibold text-success">
        {eyebrow}
      </div>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel}
          className={cn(
            body,
            "text-start outline-none transition-colors hover:bg-surface-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]",
          )}
        >
          {content}
          <span className="flex shrink-0 items-center gap-1">
            {status}
            <ChevronRight
              className="size-4 text-fg-subtle rtl:rotate-180"
              aria-hidden="true"
            />
          </span>
        </button>
      ) : (
        <div className={body}>
          {content}
          {status ? <span className="shrink-0">{status}</span> : null}
        </div>
      )}
      {footer || action ? (
        <div className="flex items-center justify-between gap-3 bg-surface-muted px-3 py-2">
          <span className="min-w-0 text-sm text-fg-muted">{footer}</span>
          {/* Card actions lift off the grey footer with a shadow rather than an outline. */}
          <span className="flex shrink-0 items-center gap-2 *:border-0 *:shadow-sm">
            {action}
          </span>
        </div>
      ) : null}
    </article>
  );
}
