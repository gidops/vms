"use client";

import type { EvacuationRoll, EvacuationRollRow } from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  Button,
  EmptyState,
  Pagination,
  PrintSheet,
  RecordTable,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@vms/ui";
import { CheckCircle2, LifeBuoy, Printer, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { useEvacuationRoll } from "@/data/evacuation/queries";
import { formatWatDateTime, formatWatTime } from "@/shared/wat";
import { useEvacuationAssistText } from "./EvacuationAssist";
import print from "./EvacuationRollPrint.module.css";

export interface FloorGroup {
  floor: string | null;
  rows: EvacuationRollRow[];
}

/** Groups by floor, keeping the server's top-floor-first order. */
export function groupByFloor(rows: EvacuationRollRow[]): FloorGroup[] {
  const groups: FloorGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.floor === row.floor) last.rows.push(row);
    else groups.push({ floor: row.floor, rows: [row] });
  }
  return groups;
}

function CountBanner({
  roll,
  floors,
}: {
  roll: EvacuationRoll;
  floors: number;
}) {
  const t = useTranslations("evacuation");
  const empty = roll.count === 0;
  return (
    // Polite: the roll refreshes every minute and shouldn't interrupt.
    <Alert
      role="status"
      intent={empty ? "success" : "warning"}
      icon={empty ? CheckCircle2 : LifeBuoy}
      className="border-0"
    >
      <AlertTitle className="text-base">
        <span className="me-2">{roll.count}</span>
        {t("countBanner")}
        {!empty ? (
          <span className="font-normal text-fg-muted">
            {" · "}
            {t("floors", { count: floors })}
          </span>
        ) : null}
      </AlertTitle>
    </Alert>
  );
}

function FloorLabel({ floor }: { floor: string | null }) {
  const t = useTranslations("evacuation");
  return <>{floor ?? t("noFloor")}</>;
}

const COLUMN_COUNT = 6;
const PAGE_SIZE = 10;

function RollTable({
  groups,
  floorTotals,
}: {
  groups: FloorGroup[];
  /** Whole-roll count per floor, so a floor split across pages shows its full size. */
  floorTotals: Map<string | null, number>;
}) {
  const t = useTranslations("evacuation");
  const tCard = useTranslations("rfidCard");
  const assistText = useEvacuationAssistText();
  const locale = useLocale();
  return (
    <>
      <div className="hidden md:block">
        <Table aria-label={t("title")}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.visitor")}</TableHead>
              <TableHead>{t("columns.assistance")}</TableHead>
              <TableHead>{t("columns.floor")}</TableHead>
              <TableHead>{t("columns.host")}</TableHead>
              <TableHead>{t("columns.phone")}</TableHead>
              <TableHead>{t("columns.checkedIn")}</TableHead>
            </TableRow>
          </TableHeader>
          {groups.map((g) => (
            <TableBody key={g.floor ?? "none"}>
              <TableRow className="border-t hover:bg-transparent">
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-2.5 font-semibold text-fg"
                >
                  <FloorLabel floor={g.floor} />
                  <span className="ms-2 font-normal text-fg-muted">
                    · {floorTotals.get(g.floor) ?? g.rows.length}
                  </span>
                </TableCell>
              </TableRow>
              {g.rows.map((r, i) => (
                <TableRow
                  key={r.visitId}
                  className={i % 2 === 1 ? "bg-surface-stripe" : undefined}
                >
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <Avatar name={r.fullName} size="md" accent="single" />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium text-fg">
                          {r.fullName}
                        </span>
                        {r.organization ? (
                          <span className="text-xs text-fg-muted">
                            {r.organization}
                          </span>
                        ) : null}
                        {r.rfidCardNumber ? (
                          <span className="text-xs text-fg-muted" dir="ltr">
                            {tCard("badge", { number: r.rfidCardNumber })}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-fg-muted">
                    {r.assistTypes.length
                      ? assistText(r.assistTypes, r.assistOther)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-fg-muted">
                    <FloorLabel floor={r.floor} />
                  </TableCell>
                  <TableCell className="text-fg-muted">
                    {r.hostName ?? "—"}
                  </TableCell>
                  <TableCell className="text-fg-muted" dir="ltr">
                    {r.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-fg-muted">
                    {formatWatTime(r.checkInAt, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      </div>

      {/* Phone: grouped cards for wardens on the move. */}
      <ul
        className="flex flex-col overflow-hidden rounded-lg border border-border md:hidden"
        aria-label={t("title")}
      >
        {groups.map((g) => (
          <li key={g.floor ?? "none"}>
            <p className="border-b border-border-subtle px-4 py-2 text-sm font-semibold text-fg">
              <FloorLabel floor={g.floor} />
              <span className="ms-2 font-normal text-fg-muted">
                · {floorTotals.get(g.floor) ?? g.rows.length}
              </span>
            </p>
            <ul>
              {g.rows.map((r) => (
                <li
                  key={r.visitId}
                  className="flex items-start gap-3 border-b border-border-subtle px-4 py-3"
                >
                  <Avatar name={r.fullName} size="md" accent="single" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-fg">
                        {r.fullName}
                      </span>
                      <span className="shrink-0 text-sm text-fg-muted">
                        {formatWatTime(r.checkInAt, locale)}
                      </span>
                    </div>
                    {r.organization ? (
                      <span className="truncate text-xs text-fg-muted">
                        {r.organization}
                      </span>
                    ) : null}
                    {r.rfidCardNumber ? (
                      <span className="text-xs text-fg-muted" dir="ltr">
                        {tCard("badge", { number: r.rfidCardNumber })}
                      </span>
                    ) : null}
                    {r.assistTypes.length ? (
                      <span className="text-xs text-fg-muted">
                        {assistText(r.assistTypes, r.assistOther)}
                      </span>
                    ) : null}
                    <span className="text-sm text-fg">
                      <FloorLabel floor={r.floor} />
                      {r.hostName ? (
                        <span className="text-fg-muted">
                          {" · "}
                          {r.hostName}
                        </span>
                      ) : null}
                    </span>
                    {r.phone ? (
                      <a
                        href={`tel:${r.phone}`}
                        className="rounded-sm text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                        dir="ltr"
                      >
                        {r.phone}
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The paper copy for wardens; <thead> repeats on every A4 page. */
function PrintRoll({
  roll,
  groups,
}: {
  roll: EvacuationRoll;
  groups: FloorGroup[];
}) {
  const t = useTranslations("evacuation");
  const tCard = useTranslations("rfidCard");
  const assistText = useEvacuationAssistText();
  const locale = useLocale();
  return (
    <PrintSheet className={print.sheet} data-testid="evacuation-print">
      <table className={print.table}>
        <thead>
          <tr>
            <th colSpan={6} className={print.header}>
              <div className={print.brand}>{t("print.heading")}</div>
              <div className={print.meta}>
                {t("print.generated", {
                  datetime: formatWatDateTime(roll.generatedAt, locale),
                })}
                {" · "}
                {t("print.count", { count: roll.count })}
              </div>
            </th>
          </tr>
          <tr className={print.columns}>
            <th>{t("columns.visitor")}</th>
            <th>{t("columns.organization")}</th>
            <th>{t("columns.host")}</th>
            <th>{t("columns.phone")}</th>
            <th>{t("columns.checkedIn")}</th>
            <th>{t("columns.badge")}</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.floor ?? "none"}>
            <tr className={print.floor}>
              <td colSpan={6}>
                <FloorLabel floor={g.floor} /> · {g.rows.length}
              </td>
            </tr>
            {g.rows.map((r) => (
              <tr key={r.visitId}>
                <td>
                  {r.fullName}
                  {r.assistTypes.length ? (
                    <>
                      <br />
                      {assistText(r.assistTypes, r.assistOther)}
                    </>
                  ) : null}
                </td>
                <td>{r.organization ?? ""}</td>
                <td>{r.hostName ?? "—"}</td>
                <td dir="ltr">{r.phone ?? "—"}</td>
                <td>{formatWatTime(r.checkInAt, locale)}</td>
                <td>
                  {[
                    r.badge?.zone,
                    r.badge?.cardNumber,
                    r.rfidCardNumber
                      ? tCard("badge", { number: r.rfidCardNumber })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </PrintSheet>
  );
}

export function EvacuationRollScreen({
  headingLevel = 1,
  showHeading = true,
}: {
  headingLevel?: 1 | 2;
  /** Off where the host already names the screen (the Insights tab). */
  showHeading?: boolean;
} = {}) {
  // Under another page's h1 (Insights) the title steps down a level.
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const headingSize = headingLevel === 2 ? "text-2xl" : "text-3xl";
  const t = useTranslations("evacuation");
  const roll = useEvacuationRoll();
  const data = roll.data;
  const groups = React.useMemo(
    () => (data ? groupByFloor(data.rows) : []),
    [data],
  );
  const floorTotals = React.useMemo(
    () => new Map(groups.map((g) => [g.floor, g.rows.length])),
    [groups],
  );
  const empty = !!data && data.count === 0;

  // Client-side pages over the live roll; clamp when a refresh shrinks it.
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil((data?.rows.length ?? 0) / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const pageGroups = React.useMemo(
    () =>
      groupByFloor(
        (data?.rows ?? []).slice(
          (currentPage - 1) * PAGE_SIZE,
          currentPage * PAGE_SIZE,
        ),
      ),
    [data, currentPage],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {showHeading ? (
            <Heading className={`${headingSize} font-semibold text-primary`}>
              {t("title")}
            </Heading>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium text-fg transition-colors outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-60"
            onClick={() => void roll.refetch()}
            disabled={roll.isFetching}
            aria-busy={roll.isFetching || undefined}
          >
            <RefreshCw
              className={cn("size-4", roll.isFetching && "animate-spin")}
              aria-hidden="true"
            />
            {t("refresh")}
          </button>
        </div>
        <Button onClick={() => window.print()} disabled={!data || empty}>
          <Printer className="size-4" aria-hidden="true" />
          {t("print.button")}
        </Button>
      </div>

      {data ? <CountBanner roll={data} floors={groups.length} /> : null}

      {roll.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : roll.isError && !data ? (
        <Alert intent="danger">
          <AlertDescription>{t("loadError")}</AlertDescription>
        </Alert>
      ) : (
        <RecordTable
          frameless
          isEmpty={empty}
          pagination={
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          }
          emptyState={
            <EmptyState
              icon={CheckCircle2}
              title={t("empty.title")}
              description={t("empty.body", {
                count: data?.checkedInTotal ?? 0,
              })}
            />
          }
        >
          <RollTable groups={pageGroups} floorTotals={floorTotals} />
        </RecordTable>
      )}

      {data && !empty ? <PrintRoll roll={data} groups={groups} /> : null}
    </div>
  );
}
