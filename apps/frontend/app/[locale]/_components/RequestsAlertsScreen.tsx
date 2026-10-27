"use client";

import { VISIT_PURPOSES } from "@vms/contracts";
import {
  Badge,
  EmptyState,
  FilterBar,
  InboxCard,
  type InboxCardType,
  SearchInput,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  TopNavShell,
} from "@vms/ui";
import { Inbox, MessageSquare } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { InboxPagination } from "@/app/[locale]/_components/InboxPagination";
import { VisitDetailSheet } from "@/app/[locale]/_components/VisitDetailSheet";
import type { InboxItem, InboxKind } from "@/data/inbox/inbox.api";
import {
  useInbox,
  useMarkInboxSeen,
  type InboxFilters,
} from "@/data/requests/queries";

type Intent = "warning" | "success" | "danger" | "neutral";
type Selected = { kind: "request" | "alert"; id: string };

const ALL = "all";
const REQUEST_STATUSES = [
  "PENDING",
  "REVIEW_REQUESTED",
  "FLAGGED",
  "APPROVED",
  "DENIED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "EXPIRED",
] as const;
const ALERT_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "DISMISSED",
] as const;
const VISIT_TYPES = ["WALK_IN", "PRE_INVITED", "APPOINTMENT"] as const;

/** Security Manager approve/deny/needs-info updates render as "Security Manager Feedback" cards. */
const FEEDBACK_STATUSES = ["REVIEW_REQUESTED", "APPROVED", "DENIED"];

function cardType(item: InboxItem): InboxCardType {
  if (item.kind === "alert" || item.kind === "card") return "alert";
  return FEEDBACK_STATUSES.includes(item.status) ? "feedback" : "request";
}

function statusMeta(item: Exclude<InboxItem, { kind: "card" }>): {
  key: string;
  intent: Intent;
} {
  if (item.kind === "request") {
    const map: Record<string, { key: string; intent: Intent }> = {
      PENDING: { key: "awaitingApproval", intent: "warning" },
      REVIEW_REQUESTED: { key: "reviewRequested", intent: "danger" },
      FLAGGED: { key: "flagged", intent: "danger" },
      APPROVED: { key: "approvedBySm", intent: "success" },
      DENIED: { key: "deniedBySm", intent: "danger" },
      CANCELLED: { key: "cancelled", intent: "neutral" },
      CHECKED_IN: { key: "onsite", intent: "success" },
      CHECKED_OUT: { key: "checkedOut", intent: "neutral" },
      EXPIRED: { key: "expired", intent: "neutral" },
    };
    return map[item.status] ?? { key: "awaitingApproval", intent: "warning" };
  }
  const map: Record<string, { key: string; intent: Intent }> = {
    OPEN: { key: "open", intent: "danger" },
    ACKNOWLEDGED: { key: "acknowledged", intent: "warning" },
    RESOLVED: { key: "resolved", intent: "success" },
    DISMISSED: { key: "dismissed", intent: "neutral" },
  };
  return map[item.status] ?? { key: "open", intent: "danger" };
}

export function RequestsAlertsScreen({
  app = "vmc",
  scope = "all",
  title,
}: {
  app?: "vmc" | "staff" | "admin";
  scope?: "all" | "mine";
  /** Defaults to "Requests & Alerts". */
  title?: string;
}) {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const tDash = useTranslations("dashboard");
  const tCard = useTranslations("rfidCard");
  const format = useFormatter();
  // next-intl needs an explicit "now" for relative times, otherwise it warns.
  const now = useNow();

  const [tab, setTab] = React.useState<InboxKind>("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>(ALL);
  const [purpose, setPurpose] = React.useState<string>(ALL);
  const [type, setType] = React.useState<string>(ALL);
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Selected | null>(null);

  React.useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Changing tab/filters returns to the first page (handlers, not an effect).
  const resetTo =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  // Mark read after a short beat so the unread highlight shows, then fades.
  const markSeen = useMarkInboxSeen();
  const markSeenMutate = markSeen.mutate;
  React.useEffect(() => {
    const id = setTimeout(() => markSeenMutate(), 1500);
    return () => clearTimeout(id);
  }, [markSeenMutate]);

  const filters: InboxFilters = {
    page,
    pageSize: 12,
    search: search || undefined,
    status: status === ALL ? undefined : status,
    purpose: purpose === ALL ? undefined : purpose,
    type: type === ALL ? undefined : (type as InboxFilters["type"]),
  };
  const { data, isLoading } = useInbox(tab, { scope, ...filters });
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const statusOptions = tab === "alerts" ? ALERT_STATUSES : REQUEST_STATUSES;

  const statusOf = (item: InboxItem): { label: string; intent: Intent } => {
    if (item.kind === "card")
      return { label: t("cardItem.overdue"), intent: "warning" };
    const { key, intent } = statusMeta(item);
    return { label: t(`status.${key}`), intent };
  };

  const openItem = (item: InboxItem): (() => void) | undefined => {
    if (item.kind === "request")
      return () => setSelected({ kind: "request", id: item.visitId });
    if (item.kind === "alert")
      return () => setSelected({ kind: "alert", id: item.alertId });
    const { visitId } = item;
    return visitId
      ? () => setSelected({ kind: "request", id: visitId })
      : undefined;
  };

  const describe = (item: InboxItem): React.ReactNode => {
    if (item.kind === "alert") return item.reason;
    if (item.kind === "card")
      return t("cardItem.desc", {
        visitor: item.visitorName,
        number: item.cardNumber,
        due: format.dateTime(new Date(item.validUntil), {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      });
    // These sentences end with "…from" so the org is emphasised at the end.
    if (item.status === "PENDING" || item.status === "REVIEW_REQUESTED") {
      return (
        <>
          {t(`card.desc.${item.status}`, { visitor: item.visitorName })}
          {item.organization ? (
            <>
              {" "}
              <span className="font-semibold text-primary">
                {item.organization}
              </span>
            </>
          ) : null}
          .
        </>
      );
    }
    return t(`card.desc.${item.status}`, {
      visitor: item.visitorName,
      host: item.hostName ?? item.visitorName,
    });
  };

  const titleOf = (item: InboxItem): string => {
    if (item.kind === "card") return t("cardItem.title");
    return item.kind === "alert"
      ? (item.category ?? t("card.flaggedTitle"))
      : t(`card.title.${item.status}`, {
          visitor: item.visitorName,
          host: item.hostName ?? item.visitorName,
        });
  };

  const typeLabelOf = (item: InboxItem): string => {
    if (item.kind === "card") return t("typeCard");
    const ct = cardType(item);
    if (ct === "alert") return t("typeAlert");
    if (ct === "feedback") return t("typeFeedback");
    return t("typeRequest");
  };

  return (
    <TopNavShell
      nav={<AppTopNav app={app} active="requests" />}
      filterBar={
        <FilterBar>
          <div className="min-w-56 flex-1">
            <SearchInput
              placeholder={tDash("filters.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {/* Cards have no status, visit type or purpose to filter on. */}
          {tab === "cards" ? null : (
            <>
              <Select value={status} onValueChange={resetTo(setStatus)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{tCommon("allStatus")}</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`statusOption.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={type} onValueChange={resetTo(setType)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    {tDash("filters.allVisitTypes")}
                  </SelectItem>
                  {VISIT_TYPES.map((vt) => (
                    <SelectItem key={vt} value={vt}>
                      {t(`typeOption.${vt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={purpose} onValueChange={resetTo(setPurpose)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    {tDash("filters.allPurpose")}
                  </SelectItem>
                  {VISIT_PURPOSES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </FilterBar>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-primary">
            {title ?? t("title")}
          </h1>
          <SegmentedControl
            aria-label={t("title")}
            value={tab}
            onValueChange={(v) => {
              setTab(v as InboxKind);
              setStatus(ALL); // status options differ per tab
              setPage(1);
            }}
            options={[
              { value: "all", label: t("tabs.all") },
              { value: "requests", label: t("tabs.requests") },
              { value: "alerts", label: t("tabs.alerts") },
              // Overdue cards are only served to readers of every visit.
              ...(scope === "all"
                ? [{ value: "cards", label: t("tabs.cards") }]
                : []),
            ]}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Inbox} title={t("empty")} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {items.map((item) => {
                const status = statusOf(item);
                return (
                  <InboxCard
                    key={item.id}
                    type={cardType(item)}
                    typeLabel={typeLabelOf(item)}
                    title={titleOf(item)}
                    description={describe(item)}
                    unread={item.unread}
                    timeAgo={format.relativeTime(new Date(item.updatedAt), now)}
                    meta={
                      <>
                        {item.createdByName ? (
                          <Badge intent="neutral" tone="soft">
                            {t("createdBy")}{" "}
                            <span className="font-semibold text-primary">
                              {item.createdByName}
                            </span>
                          </Badge>
                        ) : null}
                        {item.kind === "card" ? (
                          <Badge intent="neutral" tone="soft">
                            <span dir="ltr">
                              {tCard("badge", { number: item.cardNumber })}
                            </span>
                          </Badge>
                        ) : null}
                        <Badge intent={status.intent} tone="soft">
                          {status.label}
                        </Badge>
                        {item.notesCount > 0 ? (
                          <Badge intent="neutral" tone="soft">
                            <MessageSquare
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            {t("notesCount", { count: item.notesCount })}
                          </Badge>
                        ) : null}
                      </>
                    }
                    onClick={openItem(item)}
                  />
                );
              })}
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
          onClose={() => setSelected(null)}
        />
      ) : null}
    </TopNavShell>
  );
}
