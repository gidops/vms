"use client";

import {
  AUDIT_CATEGORIES,
  PERMISSIONS,
  type AuditCategory,
} from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  Button,
  DetailDrawer,
  EmptyState,
  Input,
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
import { Download, ScrollText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { FilterPills } from "@/app/[locale]/_components/FilterPills";
import { Field } from "@/app/[locale]/_components/visit-detail/helpers";
import { SheetSection } from "@/app/[locale]/_components/visit-detail/sections/SheetSection";
import type { AuditParams, AuditRow } from "@/data/audit/audit.api";
import { useAuditTrail, useExportAudit } from "@/data/audit/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { useDebounced } from "@/shared/useDebounced";
import { addDaysIso, formatWatDateTime, watTodayIso } from "@/shared/wat";

const PAGE_SIZE = 25;
const ALL = "all";
type Range = "today" | "7d" | "30d" | "custom";
const RANGE_DAYS: Record<Exclude<Range, "custom">, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
};

/** `[from, to]` WAT days for a preset ending today. */
export function auditWindow(
  range: Exclude<Range, "custom">,
  today: string = watTodayIso(),
) {
  return { from: addDaysIso(today, -(RANGE_DAYS[range] - 1)), to: today };
}

/** Human label for an action (`visit.approved` → "Visit approved"), else raw. */
function useActionLabel() {
  const t = useTranslations("operations.audit.actions");
  return (action: string) => {
    const key = action.replace(/\./g, "_");
    return t.has(key) ? t(key) : action;
  };
}

/** Every field of one audit row, with its details as formatted JSON. */
function AuditRowSheet({
  row,
  onClose,
}: {
  row: AuditRow | null;
  onClose: () => void;
}) {
  const t = useTranslations("operations.audit");
  const tCat = useTranslations("operations.audit.categories");
  const locale = useLocale();
  const label = useActionLabel();
  // [label, value, spans both columns] — long values get the full width.
  const fields: [string, React.ReactNode, boolean?][] = row
    ? [
        [t("columns.time"), formatWatDateTime(row.createdAt, locale)],
        [
          t("columns.category"),
          tCat.has(row.category) ? tCat(row.category) : row.category,
        ],
        [t("columns.action"), `${label(row.action)} (${row.action})`, true],
        [
          t("columns.user"),
          row.actor
            ? `${row.actor.fullName} · ${row.actor.email}`
            : t("system"),
          true,
        ],
        [
          t("columns.entity"),
          `${row.entityType}${row.entityId ? ` · ${row.entityId}` : ""}`,
          true,
        ],
        [t("columns.ip"), row.ip ?? "—"],
        [t("correlationId"), row.correlationId ?? "—"],
        [t("userAgent"), row.userAgent ?? "—", true],
      ]
    : [];
  return (
    <DetailDrawer
      open={!!row}
      side="start"
      onOpenChange={(open) => !open && onClose()}
      title={t("sheetTitle")}
    >
      {row ? (
        <>
          <SheetSection title={t("details")}>
            <div className="grid grid-cols-2 gap-4">
              {fields.map(([k, v, wide]) => (
                <div key={k} className={wide ? "col-span-2" : undefined}>
                  <Field label={k}>
                    <span className="break-all">{v}</span>
                  </Field>
                </div>
              ))}
            </div>
          </SheetSection>
          <SheetSection title={t("metadata")}>
            <pre
              dir="ltr"
              className="max-h-96 overflow-auto rounded-lg bg-surface-muted p-3 text-xs text-fg"
            >
              {row.metadata == null
                ? "—"
                : JSON.stringify(row.metadata, null, 2)}
            </pre>
          </SheetSection>
        </>
      ) : null}
    </DetailDrawer>
  );
}

/**
 * Audit trail: every audit row — business events (visits, users, cards, desk
 * QR, exports…) and security events (sign-ins, failures, permission denials).
 * Filter by WAT day range, category and free text; open a row for all its
 * fields; export the filtered set as CSV (the export is itself audited).
 */
export function AuditTrailTab() {
  const t = useTranslations("operations.audit");
  const tCat = useTranslations("operations.audit.categories");
  const locale = useLocale();
  const label = useActionLabel();
  const { hasPermission } = useAuth();
  const canExport = hasPermission(PERMISSIONS.AUDIT_EXPORT);

  const [range, setRange] = React.useState<Range>("7d");
  const [custom, setCustom] = React.useState(() => auditWindow("7d"));
  const [category, setCategory] = React.useState<string>(ALL);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [openRow, setOpenRow] = React.useState<AuditRow | null>(null);
  const debounced = useDebounced(search.trim());

  const days = range === "custom" ? custom : auditWindow(range);
  const customInvalid =
    range === "custom" &&
    (!custom.from || !custom.to || custom.to < custom.from);
  const params: AuditParams = {
    ...days,
    ...(category !== ALL ? { category: category as AuditCategory } : {}),
    ...(debounced ? { search: debounced } : {}),
    page,
    pageSize: PAGE_SIZE,
  };
  const list = useAuditTrail(params, !customInvalid);
  const exporter = useExportAudit();
  const data = customInvalid ? undefined : list.data;
  const reset = () => setPage(1);

  return (
    <section className="flex flex-col gap-6">
      {/* Laid out like Insights → History: range pills, then Export. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills<Range>
          aria-label={t("range")}
          value={range}
          onValueChange={(v) => {
            setRange(v);
            reset();
          }}
          options={(["today", "7d", "30d", "custom"] as const).map((value) => ({
            value,
            label: t(`ranges.${value}`),
          }))}
        />
        {canExport ? (
          <Button
            onClick={() => exporter.mutate(params)}
            disabled={exporter.isPending || customInvalid}
            aria-busy={exporter.isPending || undefined}
          >
            <Download className="size-4" aria-hidden="true" />
            {t("export")}
          </Button>
        ) : null}
      </div>

      {range === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-fg">
            {t("from")}
            <Input
              type="date"
              value={custom.from}
              max={custom.to}
              onChange={(e) => {
                setCustom((c) => ({ ...c, from: e.target.value }));
                reset();
              }}
              className="w-auto"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-fg">
            {t("to")}
            <Input
              type="date"
              value={custom.to}
              min={custom.from}
              onChange={(e) => {
                setCustom((c) => ({ ...c, to: e.target.value }));
                reset();
              }}
              className="w-auto"
            />
          </label>
          <span className="pb-2 text-xs text-fg-muted">{t("watHint")}</span>
        </div>
      ) : null}

      {exporter.isError ? (
        <Alert intent="danger">
          <AlertDescription>{t("exportError")}</AlertDescription>
        </Alert>
      ) : null}

      <RecordTable
        frameless
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3
              className="text-xl font-semibold text-primary"
              aria-live="polite"
            >
              {data ? new Intl.NumberFormat(locale).format(data.total) : "—"}{" "}
              <span className="font-normal text-fg-muted">{t("events")}</span>
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  reset();
                }}
              >
                <SelectTrigger aria-label={t("category")} className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
                  {AUDIT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {tCat(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SearchInput
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  reset();
                }}
                onClear={() => {
                  setSearch("");
                  reset();
                }}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="sm:w-72"
              />
            </div>
          </div>
        }
        isEmpty={!!data && data.items.length === 0}
        emptyState={<EmptyState icon={ScrollText} title={t("empty")} />}
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
        {customInvalid ? (
          <p className="py-10 text-center text-sm text-danger" role="alert">
            {t("rangeInvalid")}
          </p>
        ) : list.isLoading ? (
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
                <TableHead>{t("columns.time")}</TableHead>
                <TableHead>{t("columns.user")}</TableHead>
                <TableHead>{t("columns.action")}</TableHead>
                <TableHead>{t("columns.entity")}</TableHead>
                <TableHead>{t("columns.ip")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("columns.open")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody striped>
              {(data?.items ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-fg-muted">
                    {formatWatDateTime(row.createdAt, locale)}
                  </TableCell>
                  <TableCell>
                    {row.actor ? (
                      <span className="flex flex-col">
                        <span className="text-fg">{row.actor.fullName}</span>
                        <span className="text-xs text-fg-muted">
                          {row.actor.email}
                        </span>
                      </span>
                    ) : (
                      <span className="text-fg-subtle">{t("system")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-fg">{label(row.action)}</TableCell>
                  <TableCell className="text-fg-muted">
                    {row.entityType}
                  </TableCell>
                  <TableCell className="text-fg-muted" dir="ltr">
                    {row.ip ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      intent="neutral"
                      tone="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setOpenRow(row)}
                    >
                      {t("open")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </RecordTable>

      <AuditRowSheet row={openRow} onClose={() => setOpenRow(null)} />
    </section>
  );
}
