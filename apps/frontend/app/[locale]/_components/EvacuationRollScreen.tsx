"use client";

import type { EvacuationRoll, EvacuationRollRow } from "@vms/contracts";
import { Avatar, Button, Spinner, cn } from "@vms/ui";
import { Check, LifeBuoy, Printer, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { createPortal } from "react-dom";
import { useEvacuationRoll } from "@/data/evacuation/queries";
import { formatWatDateTime, formatWatTime } from "@/shared/wat";

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

const COLS =
  "grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)]";

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
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 rounded-xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        empty
          ? "border-success/30 bg-success-subtle"
          : "border-warning/30 bg-warning-subtle",
      )}
    >
      <div className="flex items-center gap-3">
        {empty ? (
          <Check className="size-6 text-success" aria-hidden="true" />
        ) : (
          <LifeBuoy className="size-6 text-warning" aria-hidden="true" />
        )}
        <p className="text-base text-fg">
          <span
            className={cn(
              "me-2 text-2xl font-bold",
              empty ? "text-success" : "text-warning",
            )}
          >
            {roll.count}
          </span>
          <span className="font-semibold">{t("countBanner")}</span>
          {!empty ? (
            <span className="text-fg-muted">
              {" · "}
              {t("floors", { count: floors })}
            </span>
          ) : null}
        </p>
      </div>
      <p className="text-sm text-fg-muted">
        {t.rich("generated", {
          time: formatWatTime(roll.generatedAt, locale),
          b: (chunks) => <b className="font-semibold text-fg">{chunks}</b>,
        })}
        {" · "}
        {t("refreshesEvery")}
      </p>
    </div>
  );
}

function FloorLabel({ floor }: { floor: string | null }) {
  const t = useTranslations("evacuation");
  return <>{floor ?? t("noFloor")}</>;
}

function RollTable({ groups }: { groups: FloorGroup[] }) {
  const t = useTranslations("evacuation");
  const locale = useLocale();
  return (
    <>
      {/* Desktop / tablet: grouped table */}
      <div role="table" aria-label={t("title")} className="hidden md:block">
        <div role="rowgroup">
          <div
            role="row"
            className={cn(
              "grid gap-4 border-b border-border bg-surface-muted px-6 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted",
              COLS,
            )}
          >
            <span role="columnheader">{t("columns.visitor")}</span>
            <span role="columnheader">{t("columns.floor")}</span>
            <span role="columnheader">{t("columns.host")}</span>
            <span role="columnheader">{t("columns.phone")}</span>
            <span role="columnheader">{t("columns.checkedIn")}</span>
          </div>
        </div>
        {groups.map((g) => (
          <div role="rowgroup" key={g.floor ?? "none"}>
            <div
              role="row"
              className="border-b border-border bg-primary-subtle/60 px-6 py-2.5 text-sm font-semibold text-primary"
            >
              <span role="cell">
                <FloorLabel floor={g.floor} />
                <span className="ms-2 font-normal text-fg-muted">
                  · {g.rows.length}
                </span>
              </span>
            </div>
            {g.rows.map((r) => (
              <div
                role="row"
                key={r.visitId}
                className={cn(
                  "grid items-center gap-4 border-b border-border px-6 py-3 last:border-b-0",
                  COLS,
                )}
              >
                <div role="cell" className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.fullName} accent="single" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-fg">
                      {r.fullName}
                    </span>
                    {r.organization ? (
                      <span className="truncate text-sm text-fg-muted">
                        {r.organization}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span role="cell" className="truncate text-fg">
                  <FloorLabel floor={r.floor} />
                </span>
                <span role="cell" className="truncate text-fg-muted">
                  {r.hostName ?? "—"}
                </span>
                <span role="cell" className="truncate text-fg" dir="ltr">
                  {r.phone ?? "—"}
                </span>
                <span role="cell" className="text-fg-muted">
                  {formatWatTime(r.checkInAt, locale)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Phone: grouped cards */}
      <ul className="flex flex-col md:hidden" aria-label={t("title")}>
        {groups.map((g) => (
          <li key={g.floor ?? "none"}>
            <p className="border-b border-border bg-primary-subtle/60 px-4 py-2 text-sm font-semibold text-primary">
              <FloorLabel floor={g.floor} />
              <span className="ms-2 font-normal text-fg-muted">
                · {g.rows.length}
              </span>
            </p>
            <ul>
              {g.rows.map((r) => (
                <li
                  key={r.visitId}
                  className="flex items-start gap-3 border-b border-border px-4 py-3"
                >
                  <Avatar name={r.fullName} accent="single" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-fg">
                        {r.fullName}
                      </span>
                      <span className="shrink-0 text-sm text-fg-muted">
                        {formatWatTime(r.checkInAt, locale)}
                      </span>
                    </div>
                    {r.organization ? (
                      <span className="truncate text-sm text-fg-muted">
                        {r.organization}
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
                        className="text-sm font-medium text-primary"
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
                <td>{r.fullName}</td>
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-fg">{t("title")}</h1>
          <p className="text-fg-muted">{t("subtitle")}</p>
        </div>
        <div className="flex gap-3">
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
          <Button
            intent="primary"
            onClick={() => window.print()}
            disabled={!data || empty}
          >
            <Printer className="size-4" aria-hidden="true" />
            {t("print.button")}
          </Button>
        </div>
      </header>

      {data ? <CountBanner roll={data} floors={groups.length} /> : null}

      <section
        aria-label={t("title")}
        className="overflow-hidden rounded-xl border border-border bg-surface"
      >
        {roll.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : roll.isError && !data ? (
          <p role="alert" className="px-6 py-10 text-center text-danger">
            {t("loadError")}
          </p>
        ) : empty ? (
          <>
            <div
              aria-hidden="true"
              className={cn(
                "hidden gap-4 border-b border-border bg-surface-muted px-6 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted md:grid",
                COLS,
              )}
            >
              <span>{t("columns.visitor")}</span>
              <span>{t("columns.floor")}</span>
              <span>{t("columns.host")}</span>
              <span>{t("columns.phone")}</span>
              <span>{t("columns.checkedIn")}</span>
            </div>
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="flex size-14 items-center justify-center rounded-full border border-success/30 bg-success-subtle">
                <Check className="size-7 text-success" aria-hidden="true" />
              </span>
              <p className="text-lg font-semibold text-fg">
                {t("empty.title")}
              </p>
              <p className="text-fg-muted">
                {t("empty.body", { count: data!.checkedInTotal })}
              </p>
            </div>
          </>
        ) : (
          <RollTable groups={groups} />
        )}
      </section>

      {data && !empty ? <PrintRoll roll={data} groups={groups} /> : null}
    </div>
  );
}
