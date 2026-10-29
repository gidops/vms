import { Spinner } from "@vms/ui";
import type * as React from "react";
import { Link } from "@/i18n/navigation";

/** The staff `RecentUpdates` card frame: title + "See all" link, then a body. */
export function FeedCard({
  title,
  seeAllHref,
  seeAllLabel,
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: {
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    // Small screens drop the panel frame: the entries stand as their own cards.
    <section className="flex flex-col gap-4 md:rounded-xl md:border md:border-border md:bg-surface md:p-5 md:shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="text-sm font-medium text-primary underline"
          >
            {seeAllLabel}
          </Link>
        ) : null}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : isEmpty ? (
        <p className="py-6 text-center text-sm text-fg-subtle">{emptyLabel}</p>
      ) : (
        children
      )}
    </section>
  );
}
