"use client";

import { PERMISSIONS } from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  Avatar,
  Badge,
  Button,
  DetailDrawer,
  EmptyState,
  Pagination,
  RecordTable,
  SearchInput,
  Spinner,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { CalendarDays, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { CommsOptInsScreen } from "@/app/[locale]/_components/CommsOptInsScreen";
import {
  FilterPills,
  SCROLLING_PILLS,
} from "@/app/[locale]/_components/FilterPills";
import { RecordCard } from "@/app/[locale]/_components/RecordCard";
import { Field } from "@/app/[locale]/_components/visit-detail/helpers";
import { SheetSection } from "@/app/[locale]/_components/visit-detail/sections/SheetSection";
import type { VisitorDetail, VisitorItem } from "@/data/insights/insights.api";
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

function HistoryRow({ visit }: { visit: VisitorDetail["visits"][number] }) {
  const locale = useLocale();
  const when = visit.checkInAt ?? visit.scheduledAt;
  return (
    <li className="flex items-start gap-3 border-t border-border py-3 first:border-t-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
        <CalendarDays className="size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-fg">
          {when ? formatWatDateTime(when, locale) : "—"}
        </span>
        <span className="text-sm text-fg-muted">
          {[visit.purpose, visit.hostName, visit.floor]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <StatusBadge status={visit.status} />
    </li>
  );
}

function VisitorSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("insights.visitors");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const { data, isLoading, isError } = useInsightsVisitor(id);
  const date = (d: string | null) => (d ? formatWatDateTime(d, locale) : "—");

  return (
    <DetailDrawer
      open={!!id}
      side="start"
      onOpenChange={(open) => !open && onClose()}
      title={t("sheetTitle")}
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : isError || !data ? (
        <Alert intent="danger">
          <AlertDescription>{t("error")}</AlertDescription>
        </Alert>
      ) : (
        <>
          <SheetSection title={t("visitorInfo")}>
            <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={data.fullName} size="md" />
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-fg">{data.fullName}</span>
                  {data.organization ? (
                    <span className="text-sm text-fg-muted">
                      {data.organization}
                    </span>
                  ) : null}
                  <span className="text-sm text-fg-muted">
                    {data.email}
                    {data.phone ? ` · ${data.phone}` : ""}
                  </span>
                </div>
              </div>
              <OptInBadge value={data.commsOptIn} />
            </div>
          </SheetSection>

          <SheetSection title={t("summary")}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("columns.visits")}>
                {nf.format(data.visitCount)}
              </Field>
              <Field label={t("avgStay")}>
                {data.avgDurationMinutes === null
                  ? "—"
                  : t("minutes", { count: data.avgDurationMinutes })}
              </Field>
              <Field label={t("firstVisit")}>{date(data.firstVisitAt)}</Field>
              <Field label={t("columns.lastVisit")}>
                {date(data.lastVisitAt)}
              </Field>
            </div>
          </SheetSection>

          <SheetSection
            title={
              <span className="inline-flex items-center gap-2">
                {t("visitHistory")}
                <Badge intent="neutral" tone="outline" size="sm">
                  {nf.format(data.visits.length)}
                </Badge>
              </span>
            }
          >
            {data.visits.length ? (
              <ul>
                {data.visits.map((v) => (
                  <HistoryRow key={v.id} visit={v} />
                ))}
              </ul>
            ) : (
              <p className="py-3 text-sm text-fg-subtle">{t("noVisits")}</p>
            )}
          </SheetSection>
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
          <>
            <div className="hidden md:block">
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
            </div>

            {/* Small screens: each visitor as a tappable card. */}
            <div className="flex flex-col gap-4 md:hidden">
              {(data?.items ?? []).map((v) => (
                <RecordCard
                  key={v.id}
                  eyebrow={
                    v.lastVisitAt
                      ? `${t("columns.lastVisit")}: ${formatWatDateTime(v.lastVisitAt, locale)}`
                      : t("columns.lastVisit")
                  }
                  title={v.fullName}
                  subtitle={v.email}
                  extra={
                    v.organization ? (
                      <span className="text-sm text-fg-muted">
                        {v.organization}
                      </span>
                    ) : undefined
                  }
                  status={<OptInBadge value={v.commsOptIn} />}
                  footer={`${t("columns.visits")}: ${nf.format(v.visitCount)}`}
                  action={
                    <Button
                      intent="neutral"
                      tone="outline"
                      size="sm"
                      className="min-w-28 text-xs"
                      onClick={() => setOpenId(v.id)}
                    >
                      {t("viewHistory")}
                    </Button>
                  }
                  onOpen={() => setOpenId(v.id)}
                  openLabel={t("openFor", { name: v.fullName })}
                />
              ))}
            </div>
          </>
        )}
      </RecordTable>
      <VisitorSheet id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

type View = "directory" | "optIns";

/** Facility-wide with visitor:read, otherwise only the caller's own visitors. */
export function VisitorsTab() {
  const t = useTranslations("insights.visitors");
  const { hasPermission } = useAuth();
  const showOptIns = hasPermission(PERMISSIONS.CONSENT_READ);
  const [view, setView] = React.useState<View>("directory");

  return (
    <section className="flex flex-col gap-6">
      {showOptIns ? (
        <FilterPills<View>
          aria-label={t("title")}
          className={SCROLLING_PILLS}
          value={view}
          onValueChange={setView}
          options={[
            { value: "directory", label: t("views.directory") },
            { value: "optIns", label: t("views.optIns") },
          ]}
        />
      ) : null}
      {view === "optIns" && showOptIns ? <CommsOptInsScreen /> : <Directory />}
    </section>
  );
}
