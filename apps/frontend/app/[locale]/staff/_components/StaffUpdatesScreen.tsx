"use client";

import {
  EmptyState,
  FilterBar,
  InboxCard,
  type InboxCardType,
  Input,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  TopNavShell,
} from "@vms/ui";
import { Inbox } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { InboxPagination } from "@/app/[locale]/_components/InboxPagination";
import {
  VisitDetailSheet,
  type NotificationContext,
} from "@/app/[locale]/_components/VisitDetailSheet";
import { useStaffActivityFeed } from "@/data/staff/queries";
import type {
  StaffActivityCategory,
  StaffActivityItem,
} from "@/data/staff/staff.api";

const ALL = "all";
const PAGE_SIZE = 12;

const CATEGORIES: StaffActivityCategory[] = [
  "ARRIVAL_UPDATE",
  "REQUEST_UPDATE",
  "VISIT_STATUS",
  "SECURITY_ALERT",
  "SM_FEEDBACK",
];

/** Same card tints as Requests & Alerts: alerts red, SM feedback amber. */
function cardType(category: StaffActivityCategory): InboxCardType {
  if (category === "SECURITY_ALERT") return "alert";
  if (category === "SM_FEEDBACK") return "feedback";
  return "request";
}

/**
 * The staff "All Updates" page, laid out like the VMC Requests & Alerts page:
 * a filter bar (visitor search, category, day), the inbox card grid and
 * Previous / Next pagination over the host-scoped activity feed. Every filter
 * is applied server-side.
 */
export function StaffUpdatesScreen() {
  const t = useTranslations("staff.updates");
  const format = useFormatter();
  // One "now" for every relative timestamp (next-intl warns without it).
  const now = useNow();

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>(ALL);
  const [date, setDate] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<{
    kind: "request" | "alert";
    id: string;
    notification: NotificationContext;
  } | null>(null);

  // Debounce the search box into the query term (and reset to page 1).
  React.useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const feed = useStaffActivityFeed({
    search: search || undefined,
    category:
      category === ALL ? undefined : (category as StaffActivityCategory),
    date: date || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const items = feed.data?.items ?? [];
  const totalPages = feed.data?.totalPages ?? 1;

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
    <TopNavShell
      nav={<AppTopNav app="staff" active="updates" />}
      filterBar={
        <FilterBar>
          <div className="min-w-56 flex-1">
            <SearchInput
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label={t("categoryLabel")} className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`category.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            aria-label={t("dateLabel")}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
            className="w-44"
          />
        </FilterBar>
      }
    >
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold text-primary">{t("allTitle")}</h1>

        {feed.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Inbox} title={t("empty")} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {items.map((item) => (
                <InboxCard
                  key={item.id}
                  type={cardType(item.category)}
                  typeLabel={t(`category.${item.category}`)}
                  title={item.title}
                  description={item.body}
                  timeAgo={format.relativeTime(new Date(item.createdAt), now)}
                  onClick={() => openItem(item)}
                />
              ))}
            </div>
            <InboxPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
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
