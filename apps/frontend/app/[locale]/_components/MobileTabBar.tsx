"use client";

import { cn } from "@vms/ui";
import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

export interface MobileTab {
  value: string;
  label: string;
  icon: LucideIcon;
  href: string;
  count?: number;
}

/**
 * Bottom tab bar holding the navbar's section tabs on small screens. `order-last`
 * drops it to the foot of the shell's full-height column, so the scrolling
 * content above shrinks to fit rather than running underneath it.
 */
export function MobileTabBar({
  tabs,
  active,
  "aria-label": ariaLabel,
}: {
  tabs: MobileTab[];
  active: string;
  "aria-label": string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="order-last shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {tabs.map(({ value, label, icon: Icon, href, count }) => {
          const current = value === active;
          return (
            <li key={value} className="flex-1">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]",
                  current ? "text-primary" : "text-fg-muted hover:text-fg",
                )}
              >
                <span className="relative">
                  <Icon
                    className="size-6"
                    strokeWidth={current ? 2.25 : 1.75}
                    aria-hidden="true"
                  />
                  {count ? (
                    <span
                      className="absolute -end-2.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-semibold leading-4 text-danger-fg"
                      aria-hidden="true"
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate px-1">{label}</span>
                {count ? <span className="sr-only">({count})</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
