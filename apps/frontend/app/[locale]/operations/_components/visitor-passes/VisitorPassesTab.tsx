"use client";

import { FLOORS, type VisitorPassStatus } from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  Button,
  EmptyState,
  Pagination,
  RecordTable,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { BookPlus, IdCard, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import {
  FilterPills,
  SCROLLING_PILLS,
} from "@/app/[locale]/_components/FilterPills";
import { RecordCard } from "@/app/[locale]/_components/RecordCard";
import {
  useVisitorPasses,
  useVisitorPassSummary,
} from "@/data/visitor-passes/queries";
import type { PassItem } from "@/data/visitor-passes/visitor-passes.api";
import { useDebounced } from "@/shared/useDebounced";
import { formatWatDateTime } from "@/shared/wat";
import { PassSheet } from "./PassSheet";
import { PassStatusBadge } from "./PassStatusBadge";
import { PrintPassesDialog } from "./PrintPassesDialog";
import { RecordPassesDialog } from "./RecordPassesDialog";

const PAGE_SIZE = 20;
const ALL = "all";
type StatusFilter = typeof ALL | VisitorPassStatus;

function Summary() {
  const t = useTranslations("operations.visitorPasses.summary");
  const locale = useLocale();
  const { data } = useVisitorPassSummary();
  const nf = new Intl.NumberFormat(locale);
  const tiles = [
    { label: t("total"), value: data?.total },
    { label: t("available"), value: data?.available },
    { label: t("inUse"), value: data?.inUse },
    { label: t("retired"), value: data?.retired },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4"
        >
          <dt className="text-sm text-fg-muted">{tile.label}</dt>
          <dd className="text-2xl font-semibold text-fg">
            {tile.value === undefined ? "—" : nf.format(tile.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Producing passes for reception: print, record existing ones, reprint, retire. Assigning stays at the VMC. */
export function VisitorPassesTab() {
  const t = useTranslations("operations.visitorPasses");
  const locale = useLocale();
  const [status, setStatus] = React.useState<StatusFilter>(ALL);
  const [zone, setZone] = React.useState<string>(ALL);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [printOpen, setPrintOpen] = React.useState(false);
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const debounced = useDebounced(search.trim());

  const list = useVisitorPasses({
    status: status === ALL ? undefined : status,
    zone: zone === ALL ? undefined : zone,
    search: debounced || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const data = list.data;
  const filtered = status !== ALL || zone !== ALL || !!debounced;

  const lastPrinted = (p: PassItem) =>
    p.lastPrintedAt ? formatWatDateTime(p.lastPrintedAt, locale) : t("never");
  const view = (p: PassItem) => (
    <Button
      intent="neutral"
      tone="outline"
      size="sm"
      className="min-w-24 text-xs"
      onClick={() => setOpenId(p.id)}
    >
      {t("view")}
    </Button>
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <p className="max-w-2xl text-sm text-fg-muted">{t("intro")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            intent="neutral"
            tone="outline"
            onClick={() => setRecordOpen(true)}
          >
            <BookPlus className="size-4" aria-hidden="true" />
            {t("recordPasses")}
          </Button>
          <Button onClick={() => setPrintOpen(true)}>
            <Printer className="size-4" aria-hidden="true" />
            {t("printPasses")}
          </Button>
        </div>
      </div>

      {notice ? (
        <Alert intent="success">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <Summary />

      <RecordTable
        frameless
        toolbar={
          <div className="flex flex-col gap-3">
            <FilterPills<StatusFilter>
              aria-label={t("columns.status")}
              className={SCROLLING_PILLS}
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: ALL, label: t("filters.all") },
                { value: "AVAILABLE", label: t("filters.available") },
                { value: "IN_USE", label: t("filters.inUse") },
                { value: "RETIRED", label: t("filters.retired") },
              ]}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3
                className="text-xl font-semibold text-primary"
                aria-live="polite"
              >
                {data ? new Intl.NumberFormat(locale).format(data.total) : "—"}{" "}
                <span className="font-normal text-fg-muted">
                  {t("count", { count: data?.total ?? 0 })}
                </span>
              </h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={zone}
                  onValueChange={(v) => {
                    setZone(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    aria-label={t("filters.floor")}
                    className="sm:w-60"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>
                      {t("filters.allFloors")}
                    </SelectItem>
                    {FLOORS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <SearchInput
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  onClear={() => setSearch("")}
                  placeholder={t("filters.search")}
                  aria-label={t("filters.search")}
                  className="sm:w-56"
                />
              </div>
            </div>
          </div>
        }
        isEmpty={!!data && data.items.length === 0}
        emptyState={
          <EmptyState
            icon={IdCard}
            title={filtered ? t("noMatches") : t("empty")}
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
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.floor")}</TableHead>
                    <TableHead>{t("columns.passId")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.prints")}</TableHead>
                    <TableHead>{t("columns.lastPrinted")}</TableHead>
                    <TableHead>{t("columns.origin")}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t("columns.action")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody striped>
                  {(data?.items ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-fg">{p.zone}</TableCell>
                      <TableCell className="font-mono text-fg">
                        {p.cardNumber}
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col gap-1">
                          <PassStatusBadge status={p.status} />
                          {p.holder ? (
                            <span className="text-xs text-fg-muted">
                              {p.holder.visitorName}
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="text-fg-muted">
                        {new Intl.NumberFormat(locale).format(p.printCount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-fg-muted">
                        {lastPrinted(p)}
                      </TableCell>
                      <TableCell className="text-fg-muted">
                        {t(`origin.${p.origin}`)}
                      </TableCell>
                      <TableCell>{view(p)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Small screens: each pass as a tappable card. */}
            <div className="flex flex-col gap-4 md:hidden">
              {(data?.items ?? []).map((p) => (
                <RecordCard
                  key={p.id}
                  eyebrow={
                    <span dir="ltr" className="font-mono">
                      {p.cardNumber}
                    </span>
                  }
                  title={p.zone}
                  subtitle={p.holder?.visitorName ?? t(`origin.${p.origin}`)}
                  status={<PassStatusBadge status={p.status} />}
                  footer={`${t("columns.lastPrinted")}: ${lastPrinted(p)}`}
                  action={view(p)}
                  onOpen={() => setOpenId(p.id)}
                  openLabel={t("openFor", {
                    number: p.cardNumber,
                    zone: p.zone,
                  })}
                />
              ))}
            </div>
          </>
        )}
      </RecordTable>

      <PrintPassesDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        onPrinted={(count) => setNotice(t("printedNotice", { count }))}
      />
      <RecordPassesDialog open={recordOpen} onOpenChange={setRecordOpen} />
      <PassSheet id={openId} onClose={() => setOpenId(null)} />
    </section>
  );
}
