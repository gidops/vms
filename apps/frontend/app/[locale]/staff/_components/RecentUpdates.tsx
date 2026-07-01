"use client";

import { Badge, type BadgeProps, Spinner } from "@vms/ui";
import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  StaffActivityCategory,
  StaffActivityItem,
} from "@/data/staff/staff.api";
import { Link } from "@/i18n/navigation";

/** Per-category badge intent (soft tone), mapped from the Figma design. */
const CATEGORY_INTENT: Record<StaffActivityCategory, BadgeProps["intent"]> = {
  ARRIVAL_UPDATE: "info",
  CSO_FEEDBACK: "warning",
  // Not shown in the design — defaults to the Arrival intent.
  REQUEST_UPDATE: "info",
  VISIT_STATUS: "purple",
  SECURITY_ALERT: "danger",
};

/** Per-category action-link label (i18n key under `staff.updates`). */
const CATEGORY_ACTION: Record<
  StaffActivityCategory,
  "viewUpdate" | "updateRequest" | "viewDetails"
> = {
  ARRIVAL_UPDATE: "viewUpdate",
  CSO_FEEDBACK: "updateRequest",
  REQUEST_UPDATE: "viewUpdate",
  VISIT_STATUS: "viewDetails",
  SECURITY_ALERT: "viewDetails",
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
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="text-2xl font-semibold text-fg">
          {t("updates.title")}
        </h2>
        <Link
          href="/staff/requests"
          className="inline-flex items-center gap-1 text-base font-medium text-primary underline"
        >
          {t("updates.seeAll")}
          <ChevronRight className="size-[18px]" aria-hidden="true" />
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
        <ul className="flex flex-col">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 border-b border-border p-5 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge intent={CATEGORY_INTENT[item.category]} tone="soft">
                  {t(`updates.category.${item.category}`)}
                </Badge>
                <span className="text-sm font-bold text-fg-subtle">
                  {format.relativeTime(new Date(item.createdAt))}
                </span>
              </div>
              <p className="text-xl font-semibold text-fg">{item.title}</p>
              <p className="text-base text-fg-muted">
                {item.subjectName ? (
                  <>
                    <span className="font-bold text-primary underline">
                      {item.subjectName}
                    </span>{" "}
                  </>
                ) : null}
                {item.body}
              </p>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex items-center gap-1 self-end text-base font-semibold text-primary underline"
              >
                {t(`updates.${CATEGORY_ACTION[item.category]}`)}
                <ChevronRight className="size-[18px]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
