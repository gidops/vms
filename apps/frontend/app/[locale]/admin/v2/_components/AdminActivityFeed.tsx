"use client";

import { Badge, InboxCard, type InboxCardType } from "@vms/ui";
import { ChevronRight } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useRecentActivity } from "@/data/admin/queries";
import type { InboxItem } from "@/data/inbox/inbox.api";
import { FeedCard } from "./FeedCard";

type Intent = "info" | "warning" | "success" | "danger" | "neutral";

/** Event label key + badge intent for an inbox item (request status or alert). */
function eventOf(item: InboxItem): { key: string; intent: Intent } {
  if (item.kind === "alert") return { key: "alert", intent: "danger" };
  const map: Record<string, { key: string; intent: Intent }> = {
    PENDING: { key: "requested", intent: "info" },
    APPROVED: { key: "approved", intent: "success" },
    DENIED: { key: "denied", intent: "danger" },
    REVIEW_REQUESTED: { key: "reviewRequested", intent: "warning" },
    FLAGGED: { key: "flagged", intent: "danger" },
    CHECKED_IN: { key: "checkedIn", intent: "success" },
    CHECKED_OUT: { key: "checkedOut", intent: "neutral" },
    CANCELLED: { key: "cancelled", intent: "neutral" },
    EXPIRED: { key: "expired", intent: "neutral" },
  };
  return map[item.status] ?? { key: "requested", intent: "info" };
}

function cardType(item: InboxItem): InboxCardType {
  if (item.kind === "alert") return "alert";
  return ["REVIEW_REQUESTED", "APPROVED", "DENIED"].includes(item.status)
    ? "feedback"
    : "request";
}

export interface AdminActivityFeedProps {
  /**
   * `updates` — staff `RecentUpdates` card (badge, time, title, body, link).
   * `inbox` — compact VMC `InboxCard`s, as on the Requests & Alerts tab.
   */
  variant?: "updates" | "inbox";
  /** Open the related visit/alert in the detail sheet. */
  onSelect: (selected: { kind: "request" | "alert"; id: string }) => void;
}

/** Latest requests + alerts across the site, replacing `RecentActivityCard`. */
export function AdminActivityFeed({
  variant = "updates",
  onSelect,
}: AdminActivityFeedProps) {
  const t = useTranslations("admin.overview.activity");
  const tReq = useTranslations("requests");
  const tV2 = useTranslations("adminV2.feed");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const activity = useRecentActivity(variant === "inbox" ? 4 : 6);
  const items = activity.data?.items ?? [];

  const subtitle = (item: InboxItem) => {
    if (item.kind === "alert") return item.reason;
    return item.hostName
      ? t("visitorForHost", { visitor: item.visitorName, host: item.hostName })
      : item.visitorName;
  };
  const select = (item: InboxItem) =>
    onSelect(
      item.kind === "request"
        ? { kind: "request", id: item.visitId }
        : { kind: "alert", id: item.alertId },
    );

  return (
    <FeedCard
      title={t("title")}
      seeAllHref="/admin/v2/requests"
      seeAllLabel={tV2("seeAll")}
      isLoading={activity.isLoading}
      isEmpty={items.length === 0}
      emptyLabel={t("empty")}
    >
      {variant === "inbox" ? (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const type = cardType(item);
            return (
              <InboxCard
                key={item.id}
                type={type}
                typeLabel={
                  type === "alert"
                    ? tReq("typeAlert")
                    : type === "feedback"
                      ? tReq("typeFeedback")
                      : tReq("typeRequest")
                }
                title={t(`events.${eventOf(item).key}`)}
                description={subtitle(item)}
                timeAgo={format.relativeTime(new Date(item.updatedAt), now)}
                unread={item.unread}
                onClick={() => select(item)}
              />
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => {
            const event = eventOf(item);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-1.5 py-3 first:pt-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge intent={event.intent} tone="soft">
                    {t(`events.${event.key}`)}
                  </Badge>
                  <span className="text-xs text-fg-subtle">
                    {format.relativeTime(new Date(item.updatedAt), now)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-fg">
                  {item.visitorName ?? "—"}
                </p>
                <p className="text-sm text-fg-muted">{subtitle(item)}</p>
                <button
                  type="button"
                  onClick={() => select(item)}
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
      )}
    </FeedCard>
  );
}
