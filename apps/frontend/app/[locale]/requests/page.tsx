"use client";

import {
  Badge,
  Button,
  EmptyState,
  FilterBar,
  InboxCard,
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
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import type { InboxItem, InboxKind } from "@/data/inbox/inbox.api";
import { useInbox } from "@/data/requests/queries";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { RequestDrawer, type SelectedItem } from "./_components/RequestDrawer";

type Intent = "warning" | "success" | "danger" | "neutral";

function statusMeta(item: InboxItem): { key: string; intent: Intent } {
  if (item.kind === "request") {
    const map: Record<string, { key: string; intent: Intent }> = {
      PENDING: { key: "awaitingApproval", intent: "warning" },
      APPROVED: { key: "approvedByCso", intent: "success" },
      DENIED: { key: "deniedByCso", intent: "danger" },
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

function Requests() {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const tDash = useTranslations("dashboard");
  const format = useFormatter();

  const [tab, setTab] = React.useState<InboxKind>("all");
  const [selected, setSelected] = React.useState<SelectedItem | null>(null);
  const { data, isLoading } = useInbox(tab);

  const items = data?.items ?? [];

  return (
    <TopNavShell
      nav={<AppTopNav active="requests" requestsCount={data?.total} />}
      filterBar={
        <FilterBar actions={<Button>{tDash("filters.search")}</Button>}>
          <div className="min-w-56 flex-1">
            <SearchInput placeholder={tDash("filters.searchPlaceholder")} />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon("allStatus")}</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tDash("filters.allPurpose")}</SelectItem>
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
            onValueChange={(v) => setTab(v as InboxKind)}
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {items.map((item) => {
              const status = statusMeta(item);
              return (
                <InboxCard
                  key={item.id}
                  type={item.kind}
                  typeLabel={
                    item.kind === "alert" ? t("typeAlert") : t("typeRequest")
                  }
                  title={item.title}
                  description={
                    <>
                      {item.description}
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
                  }
                  timeAgo={format.relativeTime(new Date(item.createdAt))}
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
                      id: item.kind === "request" ? item.visitId : item.alertId,
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <RequestDrawer selected={selected} onClose={() => setSelected(null)} />
    </TopNavShell>
  );
}

export default function RequestsPage() {
  return (
    <RouteGuard home="/dashboard">
      <Requests />
    </RouteGuard>
  );
}
