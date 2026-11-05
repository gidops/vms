"use client";

import { Badge } from "@vms/ui";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { FeedItemCard } from "@/app/[locale]/_components/FeedItemCard";
import type {
  StaffActivityCategory,
  StaffActivityItem,
} from "@/data/staff/staff.api";

type Intent = "info" | "warning" | "success" | "danger" | "neutral";

export const CATEGORY_INTENT: Record<StaffActivityCategory, Intent> = {
  ARRIVAL_UPDATE: "info",
  SM_FEEDBACK: "warning",
  REQUEST_UPDATE: "success",
  VISIT_STATUS: "info",
  SECURITY_ALERT: "danger",
};

/** What tapping an update leads to: an alert's details, answering SM feedback, or the update itself. */
export function useUpdateActionLabel() {
  const t = useTranslations("staff.updates");
  return (item: StaffActivityItem) =>
    item.alertId
      ? t("viewDetails")
      : item.category === "SM_FEEDBACK"
        ? t("updateRequest")
        : t("viewUpdate");
}

/** A staff update as a mobile card; the whole card opens it, the link text names where. */
export function UpdateCard({
  item,
  onOpen,
}: {
  item: StaffActivityItem;
  onOpen: () => void;
}) {
  const t = useTranslations("staff.updates");
  const format = useFormatter();
  // Ticks each minute so relative times stay fresh.
  const now = useNow({ updateInterval: 60_000 });
  const actionLabel = useUpdateActionLabel();
  return (
    <FeedItemCard
      badge={
        <Badge intent={CATEGORY_INTENT[item.category]} tone="soft">
          {t(`category.${item.category}`)}
        </Badge>
      }
      time={format.relativeTime(new Date(item.createdAt), now)}
      title={item.title}
      body={item.body}
      actionLabel={actionLabel(item)}
      onOpen={onOpen}
    />
  );
}
