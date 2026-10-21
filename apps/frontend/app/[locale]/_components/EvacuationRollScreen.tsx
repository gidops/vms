"use client";

import type { EvacuationRoll, EvacuationRollRow } from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  Button,
  EmptyState,
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
import { createPortal } from "react-dom";
import { useEvacuationRoll } from "@/data/evacuation/queries";
import { formatWatDateTime, formatWatTime } from "@/shared/wat";
import { useEvacuationAssistText } from "./EvacuationAssist";

export interface FloorGroup {
  floor: string | null;
  rows: EvacuationRollRow[];
}

/**
 * Group the roll by floor, keeping the server's top-floor-first order (rows
 * arrive sorted by floor, then check-in time).
 */
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
  const locale = useLocale();
  const empty = roll.count === 0;
  return (
    // A polite live region: the roll refreshes every minute and shouldn't
    // interrupt like an alert would.
    <Alert
      role="status"
      intent={empty ? "success" : "warning"}
      icon={empty ? CheckCircle2 : LifeBuoy}
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
      <AlertDescription>
        {t.rich("generated", {
          time: formatWatTime(roll.generatedAt, locale),
          b: (chunks) => <b className="font-semibold text-fg">{chunks}</b>,
        })}
        {" · "}
        {t("refreshesEvery")}
      </AlertDescription>
    </Alert>
  );
}

function FloorLabel({ floor }: { floor: string | null }) {
  const t = useTranslations("evacuation");
  return <>{floor ?? t("noFloor")}</>;
}

const COLUMN_COUNT = 5;

function RollTable({ groups }: { groups: FloorGroup[] }) {
  const t = useTranslations("evacuation");
  const assistText = useEvacuationAssistText();
  const locale = useLocale();
  return (
    <>
      {/* Desktop / tablet: the standard records table, one body per floor */}
      <div className="hidden md:block">
        <Table aria-label={t("title")}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.visitor")}</TableHead>
              <TableHead>{t("columns.floor")}</TableHead>
              <TableHead>{t("columns.host")}</TableHead>
              <TableHead>{t("columns.phone")}</TableHead>
              <TableHead>{t("columns.checkedIn")}</TableHead>
            </TableRow>
          </TableHeader>
          {groups.map((g) => (
            <TableBody striped key={g.floor ?? "none"}>
              <TableRow className="bg-primary-subtle hover:bg-primary-subtle">
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-2.5 font-semibold text-primary"
                >
                  <FloorLabel floor={g.floor} />
                  <span className="ms-2 font-normal text-fg-muted">
                    · {g.rows.length}
                  </span>
                </TableCell>
              </TableRow>
              {g.rows.map((r) => (
                <TableRow key={r.visitId}>
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
                        {r.assistTypes.length ? (
                          <span className="text-xs font-medium text-warning">
                            {assistText(r.assistTypes, r.assistOther)}
                          </span>
                        ) : null}
                      </span>
                    </span>
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

      {/* Phone: grouped cards (wardens use this on the move) */}
      <ul
        className="flex flex-col overflow-hidden rounded-lg border border-border md:hidden"
        aria-label={t("title")}
      >
        {groups.map((g) => (
          <li key={g.floor ?? "none"}>
            <p className="border-b border-border-subtle bg-primary-subtle px-4 py-2 text-sm font-semibold text-primary">
              <FloorLabel floor={g.floor} />
              <span className="ms-2 font-normal text-fg-muted">
                · {g.rows.length}
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
                    {r.assistTypes.length ? (
                      <span className="text-xs font-medium text-warning">
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

const subscribeNoop = () => () => {};

/**
 * Print-only copy of the roll for wardens, portalled to <body> so the print
 * stylesheet can hide every bit of app chrome. A real <table> lets the browser
 * repeat the AATC header and generated timestamp (<thead>) on every A4 page.
 */
function PrintRoll({
  roll,
  groups,
}: {
  roll: EvacuationRoll;
  groups: FloorGroup[];
}) {
  const t = useTranslations("evacuation");
  const assistText = useEvacuationAssistText();
  const locale = useLocale();
  // Portals need document.body, which only exists on the client.
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <div className="evac-print-root" data-testid="evacuation-print">
      <table className="evac-print-table">
        <thead>
          <tr>
            <th colSpan={6} className="evac-print-header">
              <div className="evac-print-brand">{t("print.heading")}</div>
              <div className="evac-print-meta">
                {t("print.generated", {
                  datetime: formatWatDateTime(roll.generatedAt, locale),
                })}
                {" · "}
                {t("print.count", { count: roll.count })}
              </div>
            </th>
          </tr>
          <tr className="evac-print-cols">
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
            <tr className="evac-print-floor">
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
                  {r.badge
                    ? [r.badge.zone, r.badge.cardNumber]
                        .filter(Boolean)
                        .join(" · ")
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>,
    document.body,
  );
}

/**
 * Live Evacuation Roll, shared by the admin console (/admin/evacuation) and the
 * VMC desk (/dashboard/evacuation). Refreshes every minute; "Print for wardens"
 * prints a chrome-free, floor-grouped A4 list.
 */
export function EvacuationRollScreen() {
  const t = useTranslations("evacuation");
  const roll = useEvacuationRoll();
  const data = roll.data;
  const groups = React.useMemo(
    () => (data ? groupByFloor(data.rows) : []),
    [data],
  );
  const empty = !!data && data.count === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-primary">{t("title")}</h1>
        <div className="flex flex-wrap gap-3">
          <Button
            intent="neutral"
            tone="outline"
            onClick={() => void roll.refetch()}
            disabled={roll.isFetching}
            aria-busy={roll.isFetching || undefined}
          >
            <RefreshCw
              className={cn("size-4", roll.isFetching && "animate-spin")}
              aria-hidden="true"
            />
            {t("refresh")}
          </Button>
          <Button onClick={() => window.print()} disabled={!data || empty}>
            <Printer className="size-4" aria-hidden="true" />
            {t("print.button")}
          </Button>
        </div>
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
          <RollTable groups={groups} />
        </RecordTable>
      )}

      {data && !empty ? <PrintRoll roll={data} groups={groups} /> : null}
    </div>
  );
}
