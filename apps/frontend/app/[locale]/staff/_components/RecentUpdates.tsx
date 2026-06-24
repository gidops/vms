"use client";

import { Badge, Spinner } from "@vms/ui";
import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  StaffActivityCategory,
  StaffActivityItem,
} from "@/data/staff/staff.api";
import { Link } from "@/i18n/navigation";

type Intent = "info" | "warning" | "success" | "danger" | "neutral";

const CATEGORY_INTENT: Record<StaffActivityCategory, Intent> = {
  ARRIVAL_UPDATE: "info",
  CSO_FEEDBACK: "warning",
  REQUEST_UPDATE: "success",
  VISIT_STATUS: "info",
  SECURITY_ALERT: "danger",
};

export interface RecentUpdatesProps {
  items: StaffActivityItem[];
  isLoading: boolean;
  /** Open the related visit/alert in the detail drawer. */
  onSelect: (item: StaffActivityItem) => void;
}

export function RecentUpdates({ items, isLoading, onSelect }: RecentUpdatesProps) {
  const t = useTranslations("staff");
  const format = useFormatter();

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-fg">{t("updates.title")}</h2>
        <Link
          href="/staff/requests"
          className="text-sm font-medium text-primary underline"
        >
          {t("updates.seeAll")}
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-subtle">
          {t("updates.empty")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <Badge intent={CATEGORY_INTENT[item.category]} tone="soft">
                  {t(`updates.category.${item.category}`)}
                </Badge>
                <span className="text-xs text-fg-subtle">
                  {format.relativeTime(new Date(item.createdAt))}
                </span>
              </div>
              <p className="text-sm font-semibold text-fg">{item.title}</p>
              <p className="text-sm text-fg-muted">{item.body}</p>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex items-center gap-1 self-start text-sm font-medium text-primary underline"
              >
                {item.alertId ? t("updates.viewDetails") : t("updates.viewUpdate")}
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
