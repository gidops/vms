"use client";

import { EmptyState, Input, Spinner, TopNavShell } from "@vms/ui";
import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import {
  VisitDetailSheet,
  type NotificationContext,
} from "@/app/[locale]/_components/VisitDetailSheet";
import { UpdateCard } from "@/app/[locale]/staff/_components/UpdateCard";
import { useStaffActivityFeed } from "@/data/staff/queries";
import type {
  StaffActivityCategory,
  StaffActivityItem,
} from "@/data/staff/staff.api";

type Filter = "all" | StaffActivityCategory;

const CATEGORIES: StaffActivityCategory[] = [
  "ARRIVAL_UPDATE",
  "REQUEST_UPDATE",
  "VISIT_STATUS",
  "SECURITY_ALERT",
  "SM_FEEDBACK",
];

const chip =
  "rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

/**
 * The staff "All Updates" page — a category-filterable card grid over the
 * host-scoped activity feed. Category + day filters are applied server-side.
 */
export function StaffUpdatesScreen() {
  const t = useTranslations("staff.updates");

  const [filter, setFilter] = React.useState<Filter>("all");
  const [date, setDate] = React.useState("");
  const [selected, setSelected] = React.useState<{
    kind: "request" | "alert";
    id: string;
    notification: NotificationContext;
  } | null>(null);

  const feed = useStaffActivityFeed({
    date: date || undefined,
    category: filter === "all" ? undefined : filter,
    pageSize: 50,
  });

  const items = feed.data?.items ?? [];

  const openItem = (item: StaffActivityItem) => {
    const notification: NotificationContext = {
      category: item.category,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
    };
    if (item.alertId)
      setSelected({ kind: "alert", id: item.alertId, notification });
    else if (item.visitId)
      setSelected({ kind: "request", id: item.visitId, notification });
  };

  return (
    <TopNavShell nav={<AppTopNav app="staff" active="updates" />}>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold text-fg">{t("allTitle")}</h1>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`${chip} ${
                filter === "all"
                  ? "border-primary bg-surface text-primary"
                  : "border-border text-fg-muted hover:text-fg"
              }`}
            >
              {t("all")}
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`${chip} ${
                  filter === c
                    ? "border-primary bg-surface text-primary"
                    : "border-border text-fg-muted hover:text-fg"
                }`}
              >
                {t(`category.${c}`)}
              </button>
            ))}
          </div>
          <Input
            type="date"
            aria-label={t("allTitle")}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
        </div>

        {feed.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Inbox} title={t("empty")} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <UpdateCard key={item.id} item={item} onSelect={openItem} />
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <VisitDetailSheet
          kind={selected.kind}
          id={selected.id}
          notification={selected.notification}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </TopNavShell>
  );
}
