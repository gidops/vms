"use client";

import { Skeleton, cn } from "@vms/ui";
import { useFormatter, useNow, useTranslations } from "next-intl";
import type { InboxItem } from "@/data/inbox/inbox.api";
import { useRecentActivity } from "@/data/admin/queries";
import { Link } from "@/i18n/navigation";
import { SectionCard } from "./SectionCard";

type Tone = "danger" | "success" | "info" | "neutral" | "warning";

const TONE_CLASS: Record<Tone, string> = {
  danger: "bg-danger",
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  neutral: "bg-fg-subtle",
};

/** Event tone + i18n key for an inbox item (request status change or alert). */
function describe(item: InboxItem): { tone: Tone; key: string } {
  if (item.kind === "alert") return { tone: "danger", key: "alert" };
  switch (item.status) {
    case "PENDING":
      return { tone: "info", key: "requested" };
    case "APPROVED":
      return { tone: "success", key: "approved" };
    case "DENIED":
      return { tone: "danger", key: "denied" };
    case "REVIEW_REQUESTED":
      return { tone: "warning", key: "reviewRequested" };
    case "FLAGGED":
      return { tone: "danger", key: "flagged" };
    case "CHECKED_IN":
      return { tone: "success", key: "checkedIn" };
    case "CHECKED_OUT":
      return { tone: "neutral", key: "checkedOut" };
    case "CANCELLED":
      return { tone: "neutral", key: "cancelled" };
    case "EXPIRED":
      return { tone: "neutral", key: "expired" };
  }
}

/**
 * Latest request/alert events across the site, newest first. Not rendered when
 * there is nothing to show.
 */
export function RecentActivityCard({ className }: { className?: string }) {
  const t = useTranslations("admin.overview.activity");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const activity = useRecentActivity();
  const items = activity.data?.items ?? [];

  if (activity.isSuccess && items.length === 0) return null;

  const subtitle = (item: InboxItem) => {
    if (item.kind === "alert") return item.visitorName ?? item.reason;
    return item.hostName
      ? t("visitorForHost", { visitor: item.visitorName, host: item.hostName })
      : item.visitorName;
  };

  return (
    <SectionCard
      titleId="admin-activity"
      title={t("title")}
      className={className}
      actions={
        <Link
          href="/admin/activity"
          className="rounded text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          {t("viewAll")}
        </Link>
      }
    >
      {activity.isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : activity.isError ? (
        <p role="alert" className="text-sm text-danger">
          {t("loadError")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => {
            const { tone, key } = describe(item);
            const detail = subtitle(item);
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    TONE_CLASS[tone],
                  )}
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm text-fg">
                    <span className="font-semibold">{t(`events.${key}`)}</span>
                    {detail ? ` · ${detail}` : null}
                  </span>
                  <time
                    dateTime={item.updatedAt}
                    className="text-xs text-fg-muted"
                  >
                    {format.relativeTime(new Date(item.updatedAt), now)}
                  </time>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
