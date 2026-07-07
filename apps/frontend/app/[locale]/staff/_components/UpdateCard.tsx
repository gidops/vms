"use client";

import { Badge } from "@vms/ui";
import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  StaffActivityCategory,
  StaffActivityItem,
} from "@/data/staff/staff.api";

type Intent = "info" | "warning" | "success" | "danger" | "neutral";

const CATEGORY_INTENT: Record<StaffActivityCategory, Intent> = {
  ARRIVAL_UPDATE: "info",
  CSO_FEEDBACK: "warning",
  REQUEST_UPDATE: "success",
  VISIT_STATUS: "info",
  SECURITY_ALERT: "danger",
};

/** The link label mirrors the design's per-category call to action. */
function actionKey(
  category: StaffActivityCategory,
): "updateRequest" | "viewDetails" | "viewUpdate" {
  if (category === "CSO_FEEDBACK") return "updateRequest";
  if (category === "SECURITY_ALERT" || category === "VISIT_STATUS")
    return "viewDetails";
  return "viewUpdate";
}

/** A single update in the "All Updates" grid. */
export function UpdateCard({
  item,
  onSelect,
}: {
  item: StaffActivityItem;
  onSelect: (item: StaffActivityItem) => void;
}) {
  const t = useTranslations("staff.updates");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <Badge intent={CATEGORY_INTENT[item.category]} tone="soft">
          {t(`category.${item.category}`)}
        </Badge>
        <span className="text-xs text-fg-subtle">
          {format.relativeTime(new Date(item.createdAt))}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-fg">{item.title}</p>
        <p className="text-sm text-fg-muted">{item.body}</p>
      </div>
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="flex items-center gap-1 self-start text-sm font-medium text-primary underline"
      >
        {t(actionKey(item.category))}
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </button>
    </div>
  );
}
