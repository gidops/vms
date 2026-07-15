"use client";

import { VISIT_PURPOSES } from "@vms/contracts";
import {
  Badge,
  Button,
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
import { ChevronLeft, ChevronRight, Inbox, MessageSquare } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
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
  if (item.kind === "alert") return "alert";
  return FEEDBACK_STATUSES.includes(item.status) ? "feedback" : "request";
}

function statusMeta(item: InboxItem): { key: string; intent: Intent } {
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
}: {
  app?: "vmc" | "staff";
  scope?: "all" | "mine";
}) {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const tDash = useTranslations("dashboard");
  const format = useFormatter();
  // Anchor relative timestamps to a single "now" (next-intl needs an explicit
  // reference; without it the formatter warns and falls back to Date.now()).
  const now = useNow();

  const [tab, setTab] = React.useState<InboxKind>("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>(ALL);
  const [purpose, setPurpose] = React.useState<string>(ALL);
  const [type, setType] = React.useState<string>(ALL);
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Selected | null>(null);

  // Debounce the search box into the query term (and reset to page 1).
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

  // Opening the page marks everything read after a short beat, so the unread
  // highlight is visible first and then fades (see InboxCard transition). The
  // mutation's `mutate` is referentially stable, so this runs once on mount.
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

  const describe = (item: InboxItem): React.ReactNode => {
    if (item.kind === "alert") return item.reason;
    // PENDING / REVIEW_REQUESTED sentences end with "…from" so the org is
    // emphasised at the end; the other statuses are self-contained sentences.
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

  const titleOf = (item: InboxItem): string =>
    item.kind === "alert"
      ? (item.category ?? t("card.flaggedTitle"))
      : t(`card.title.${item.status}`, {
          visitor: item.visitorName,
          host: item.hostName ?? item.visitorName,
        });

  const typeLabelOf = (item: InboxItem): string => {
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
              <SelectItem value={ALL}>{tDash("filters.allPurpose")}</SelectItem>
              {VISIT_PURPOSES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-primary">{t("title")}</h1>
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
                const status = statusMeta(item);
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
                        <Badge intent={status.intent} tone="soft">
                          {t(`status.${status.key}`)}
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
                    onClick={() =>
                      setSelected({
                        kind: item.kind,
                        id:
                          item.kind === "request" ? item.visitId : item.alertId,
                      })
                    }
                  />
                );
              })}
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-center gap-3">
                <Button
                  intent="neutral"
                  tone="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft
                    className="size-4 rtl:rotate-180"
                    aria-hidden="true"
                  />
                  {t("pagination.prev")}
                </Button>
                <span className="text-sm text-fg-muted">
                  {t("pagination.pageOf", { page, total: totalPages })}
                </span>
                <Button
                  intent="neutral"
                  tone="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t("pagination.next")}
                  <ChevronRight
                    className="size-4 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            ) : null}
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
