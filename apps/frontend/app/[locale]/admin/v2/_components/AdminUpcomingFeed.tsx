"use client";

import { Badge } from "@vms/ui";
import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useUpcomingVisits } from "@/data/admin/queries";
import { FeedCard } from "./FeedCard";

/**
 * Visitors still to arrive today, in the staff `RecentUpdates` card style —
 * the feed-column alternative to the table's "Upcoming" range pill.
 */
export function AdminUpcomingFeed({
  onView,
}: {
  onView: (visitId: string) => void;
}) {
  const t = useTranslations("admin.overview.upcoming");
  const tV2 = useTranslations("adminV2.feed");
  const format = useFormatter();
  const upcoming = useUpcomingVisits(5);
  const items = upcoming.data?.items ?? [];

  return (
    <FeedCard
      title={t("title")}
      isLoading={upcoming.isLoading}
      isEmpty={items.length === 0}
      emptyLabel={t("empty")}
    >
      <ul className="flex flex-col divide-y divide-border">
        {items.map((v) => {
          const name =
            v.isGroupVisit && v.groupName ? v.groupName : v.visitor.fullName;
          const host = v.host?.user.fullName ?? v.floor;
          return (
            <li key={v.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  intent={v.status === "APPROVED" ? "info" : "warning"}
                  tone="soft"
                >
                  {v.status === "APPROVED" ? t("approved") : t("pending")}
                </Badge>
                {v.scheduledAt ? (
                  <time
                    dateTime={v.scheduledAt}
                    className="text-xs text-fg-subtle"
                  >
                    {format.dateTime(new Date(v.scheduledAt), {
                      timeStyle: "short",
                    })}
                  </time>
                ) : null}
              </div>
              <p className="text-sm font-semibold text-fg">{name}</p>
              {host ? (
                <p className="text-sm text-fg-muted">
                  {t("host", { name: host })}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => onView(v.id)}
                className="flex items-center gap-1 self-start text-sm font-medium text-primary underline"
              >
                {tV2("viewDetails")}
                <ChevronRight
                  className="size-4 rtl:rotate-180"
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </FeedCard>
  );
}
