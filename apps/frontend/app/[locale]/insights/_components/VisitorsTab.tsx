"use client";

import { PERMISSIONS } from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  Avatar,
  Badge,
  Button,
  DetailDrawer,
  DetailSection,
  EmptyState,
  Pagination,
  RecordTable,
  SearchInput,
  SegmentedControl,
  Spinner,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { CommsOptInsScreen } from "@/app/[locale]/_components/CommsOptInsScreen";
import type { VisitorItem } from "@/data/insights/insights.api";
import {
  useInsightsVisitor,
  useInsightsVisitors,
} from "@/data/insights/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { useDebounced } from "@/shared/useDebounced";
import { formatWatDateTime } from "@/shared/wat";

const PAGE_SIZE = 20;

/** Latest comms-consent answer as a badge; nothing when never asked. */
function OptInBadge({ value }: { value: boolean | null }) {
  const t = useTranslations("insights.visitors");
  if (value === null) return <span className="text-fg-subtle">—</span>;
  return value ? (
    <Badge intent="success">{t("optedIn")}</Badge>
  ) : (
    <Badge intent="neutral">{t("optedOut")}</Badge>
  );
}

/** One visitor's summary and visit history, in a side sheet. */
function VisitorSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("insights.visitors");
  const locale = useLocale();
  const { data, isLoading, isError } = useInsightsVisitor(id);
  const date = (d: string | null) => (d ? formatWatDateTime(d, locale) : "—");

  return (
    <DetailDrawer
      open={!!id}
      onOpenChange={(open) => !open && onClose()}
      title={data?.fullName ?? t("sheetTitle")}
      description={data ? data.email : undefined}
    >
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError || !data ? (
        <Alert intent="danger">
          <AlertDescription>{t("error")}</AlertDescription>
        </Alert>
      ) : (
        <>
          <DetailSection title={t("summary")}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-fg-muted">{t("columns.organization")}</dt>
              <dd className="text-fg">{data.organization ?? "—"}</dd>
              <dt className="text-fg-muted">{t("columns.visits")}</dt>
              <dd className="text-fg">{data.visitCount}</dd>
              <dt className="text-fg-muted">{t("firstVisit")}</dt>
              <dd className="text-fg">{date(data.firstVisitAt)}</dd>
              <dt className="text-fg-muted">{t("columns.lastVisit")}</dt>
              <dd className="text-fg">{date(data.lastVisitAt)}</dd>
              <dt className="text-fg-muted">{t("avgStay")}</dt>
              <dd className="text-fg">
                {data.avgDurationMinutes === null
                  ? "—"
                  : t("minutes", { count: data.avgDurationMinutes })}
              </dd>
              <dt className="text-fg-muted">{t("columns.comms")}</dt>
              <dd>
                <OptInBadge value={data.commsOptIn} />
              </dd>
            </dl>
          </DetailSection>
          <DetailSection title={t("visitHistory")}>
            <ol className="flex flex-col divide-y divide-border">
              {data.visits.map((v) => (
                <li key={v.id} className="flex flex-col gap-1 py-3">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-fg">
                      {date(v.scheduledAt)}
                    </span>
                    <StatusBadge status={v.status} />
                  </span>
                  <span className="text-sm text-fg-muted">
                    {[v.purpose, v.hostName, v.floor]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          </DetailSection>
        </>
      )}
    </DetailDrawer>
  );
}

function Directory() {
  const t = useTranslations("insights.visitors");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const { hasPermission } = useAuth();
  const facility = hasPermission(PERMISSIONS.VISITOR_READ);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const debounced = useDebounced(search.trim());

  const list = useInsightsVisitors({
    search: debounced || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const data = list.data;

  const row = (v: VisitorItem) => (
    <TableRow key={v.id}>
      <TableCell>
        <span className="flex items-center gap-3">
          <Avatar name={v.fullName} size="md" accent="single" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-fg">{v.fullName}</span>
            <span className="truncate text-xs text-fg-muted">{v.email}</span>
          </span>
        </span>
      </TableCell>
      <TableCell className="text-fg-muted">{v.organization ?? "—"}</TableCell>
      <TableCell className="text-fg-muted">{nf.format(v.visitCount)}</TableCell>
      <TableCell className="whitespace-nowrap text-fg-muted">
        {v.lastVisitAt ? formatWatDateTime(v.lastVisitAt, locale) : "—"}
      </TableCell>
      <TableCell>
        <OptInBadge value={v.commsOptIn} />
      </TableCell>
      <TableCell>
        <Button
          intent="neutral"
          tone="outline"
          size="sm"
          className="min-w-28 text-xs"
          onClick={() => setOpenId(v.id)}
        >
          {t("viewHistory")}
        </Button>
      </TableCell>
    </TableRow>
  );

  return (
    <>
      <RecordTable
        frameless
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3
              className="text-xl font-semibold text-primary"
              aria-live="polite"
            >
              {data ? nf.format(data.total) : "—"}{" "}
              <span className="font-normal text-fg-muted">
                {facility ? t("countFacility") : t("countMine")}
              </span>
            </h3>
            <SearchInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              onClear={() => {
                setSearch("");
                setPage(1);
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="sm:w-80"
            />
          </div>
        }
        isEmpty={!!data && data.items.length === 0}
        emptyState={
          <EmptyState
            icon={Users}
            title={debounced ? t("noMatches") : t("empty")}
          />
        }
        pagination={
          data && data.totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={data.totalPages}
              onPageChange={setPage}
            />
          ) : undefined
        }
      >
        {list.isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : list.isError ? (
          <Alert intent="danger">
            <AlertDescription>{t("error")}</AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.visitor")}</TableHead>
                <TableHead>{t("columns.organization")}</TableHead>
                <TableHead>{t("columns.visits")}</TableHead>
                <TableHead>{t("columns.lastVisit")}</TableHead>
                <TableHead>{t("columns.comms")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("columns.action")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody striped>{(data?.items ?? []).map(row)}</TableBody>
          </Table>
        )}
      </RecordTable>
      <VisitorSheet id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

type View = "directory" | "optIns";

/**
 * Visitors: everyone who came (facility-wide with visitor:read, otherwise the
 * people who came to see the caller), each opening their own visit history.
 * Holders of consent:read also get Comms opt-in (withdraw with consent:manage).
 */
export function VisitorsTab() {
  const t = useTranslations("insights.visitors");
  const { hasPermission } = useAuth();
  const showOptIns = hasPermission(PERMISSIONS.CONSENT_READ);
  const [view, setView] = React.useState<View>("directory");

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-primary">{t("title")}</h2>
        {showOptIns ? (
          <SegmentedControl
            aria-label={t("title")}
            value={view}
            onValueChange={(v) => setView(v as View)}
            options={[
              { value: "directory", label: t("views.directory") },
              { value: "optIns", label: t("views.optIns") },
            ]}
          />
        ) : null}
      </div>
      {view === "optIns" && showOptIns ? (
        <CommsOptInsScreen headingLevel={2} />
      ) : (
        <Directory />
      )}
    </section>
  );
}
