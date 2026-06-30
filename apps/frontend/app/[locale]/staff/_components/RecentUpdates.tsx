"use client";

import { cn, Spinner } from "@vms/ui";
import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  StaffActivityCategory,
  StaffActivityItem,
} from "@/data/staff/staff.api";
import { Link } from "@/i18n/navigation";

/**
 * Per-category badge colors, taken verbatim from the Figma design. These sit
 * outside the VMS palette (notably the purple Visit Status), so they are exact
 * hex arbitrary values scoped to this panel rather than Badge intents.
 */
const CATEGORY_BADGE: Record<StaffActivityCategory, string> = {
  ARRIVAL_UPDATE: "bg-[#f4f5f7] border-[#dddfe2] text-[#2a61ba]",
  CSO_FEEDBACK: "bg-[#fef8e6] border-[#fde8b1] text-[#bf6a02]",
  // Not shown in the design — defaults to the Arrival blue.
  REQUEST_UPDATE: "bg-[#f4f5f7] border-[#dddfe2] text-[#2a61ba]",
  VISIT_STATUS: "bg-[#ece0fb] border-[#8a38f5] text-[#8a38f5]",
  SECURITY_ALERT: "bg-[#ffeeee] border-[#ffb2af] text-[#cf2e2e]",
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
    <section className="overflow-hidden rounded-lg border border-[#f3f3f3] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#f3f3f3] px-5 py-3">
        <h2 className="text-2xl font-semibold text-black">
          {t("updates.title")}
        </h2>
        <Link
          href="/staff/requests"
          className="inline-flex items-center gap-1 text-base font-medium text-[#00736e] underline"
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
              className="flex flex-col gap-3 border-b border-[#f3f3f3] p-5 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium",
                    CATEGORY_BADGE[item.category],
                  )}
                >
                  {t(`updates.category.${item.category}`)}
                </span>
                <span className="text-sm font-bold text-[#8f8f8f]">
                  {format.relativeTime(new Date(item.createdAt))}
                </span>
              </div>
              <p className="text-xl font-semibold text-[#383e49]">
                {item.title}
              </p>
              <p className="text-base text-[#667185]">
                {item.subjectName ? (
                  <>
                    <span className="font-bold text-[#00aa8c] underline">
                      {item.subjectName}
                    </span>{" "}
                  </>
                ) : null}
                {item.body}
              </p>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex items-center gap-1 self-end text-base font-semibold text-[#00736e] underline"
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
