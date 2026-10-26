"use client";

import { ChevronDown, SquareActivity } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import {
  PANEL_ALERT_CLASS,
  STAT_SEPARATOR,
  StatCell as OverviewStatCell,
  cellBg,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";
import { Link } from "@/i18n/navigation";

export interface AdminOverviewProps {
  /**
   * `vmc` — `VmcOverview` layout: eyebrow + welcome across the full top row.
   * `staff` — `StaffOverview` layout: welcome over the stats, plus a trailing
   * "Pending approvals" cell above the panel (where staff show Office Floor).
   */
  variant?: "vmc" | "staff";
  /** Eyebrow text, e.g. "ADMIN CONSOLE · Super Admin" (vmc variant). */
  eyebrow: string;
  welcome: string;
  /** 3–5 stats; the grid sizes its columns to the count. */
  stats: OverviewStat[];
  /** Shown in the staff variant's top-right cell; hidden when undefined. */
  pendingCount?: number;
  /** Green emphasis panel contents (see `AdminActionPanel`). */
  panel: React.ReactNode;
  /** `alert` tints the panel muted red (people on the Evacuation Roll). */
  panelTone?: "default" | "alert";
}

function Eyebrow({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-tight text-success">
      <SquareActivity className="size-4" aria-hidden="true" />
      {text}
    </span>
  );
}

/** Staff "Office Floor" styling, pointing at the approval queue instead. */
function PendingCell({ count }: { count?: number }) {
  const t = useTranslations("adminV2.overview");
  if (count === undefined) return null;
  return (
    <Link
      href="/admin/v2/requests"
      className="flex flex-col gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      <span className="text-lg font-semibold text-primary">
        {t("pendingApprovals")}:
      </span>
      <span className="text-xl font-bold uppercase tracking-tight text-warning underline-offset-4 hover:underline">
        {t("pendingCount", { count })}
      </span>
    </Link>
  );
}

const panelClass =
  "relative flex flex-col justify-between gap-4 overflow-hidden bg-emphasis px-6 py-4 text-emphasis-fg transition-colors duration-500";

/**
 * Admin overview band — the VMC/staff unified bar (welcome row, stat cells and
 * the brand-green panel), replacing the admin page header + `StatCard` grid.
 * Mobile mirrors the originals: heading, panel, then the stats.
 */
export function AdminOverview({
  variant = "vmc",
  eyebrow,
  welcome,
  stats,
  pendingCount,
  panel,
  panelTone = "default",
}: AdminOverviewProps) {
  const tinted =
    panelClass + (panelTone === "alert" ? ` ${PANEL_ALERT_CLASS}` : "");
  const t = useTranslations("dashboard");
  const [open, setOpen] = React.useState(true);
  // Column count follows the stat count (VMC/staff fix it at three).
  const columns = `repeat(${stats.length}, minmax(0, 1fr)) minmax(300px, 1.5fr)`;

  return (
    <>
      {/* ── Desktop: one bar ─────────────────────────────────────────────── */}
      <div
        className="hidden overflow-hidden rounded-t-xl border border-border shadow-xs lg:grid"
        style={{ gridTemplateColumns: columns }}
      >
        {variant === "vmc" ? (
          <div
            className="flex flex-col gap-1 bg-surface p-6"
            style={{ gridColumn: "1 / -1" }}
          >
            <Eyebrow text={eyebrow} />
            <h1 className="text-[2rem] font-medium text-[#344054]">
              {welcome}
            </h1>
          </div>
        ) : (
          <>
            <div
              className="flex items-center bg-surface p-6"
              style={{ gridColumn: `span ${stats.length}` }}
            >
              <h1 className="text-[2rem] font-medium text-[#344054]">
                {welcome}
              </h1>
            </div>
            <div className="flex flex-col justify-center border-s border-border bg-surface-muted px-6 py-5">
              <PendingCell count={pendingCount} />
            </div>
          </>
        )}

        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={
              "border-t border-border " +
              cellBg(stat) +
              (i > 0 ? ` border-s-[2px] ${STAT_SEPARATOR}` : "")
            }
          >
            <OverviewStatCell stat={stat} />
          </div>
        ))}
        <div className={tinted + " border-s border-t border-border"}>
          {panel}
        </div>
      </div>

      {/* ── Mobile: heading, panel, then the stats ───────────────────────── */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div className="flex flex-col gap-1">
          {variant === "vmc" ? <Eyebrow text={eyebrow} /> : null}
          <h1 className="text-[2rem] font-medium text-[#344054]">{welcome}</h1>
          {variant === "staff" ? <PendingCell count={pendingCount} /> : null}
        </div>
        <div className={tinted + " rounded-xl"}>{panel}</div>

        {variant === "vmc" ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 p-4 text-start"
            >
              <span className="text-lg font-semibold text-fg-muted">
                {t("activity.title")}
              </span>
              <ChevronDown
                className={
                  "size-5 shrink-0 text-fg-muted transition-transform" +
                  (open ? " rotate-180" : "")
                }
                aria-hidden="true"
              />
            </button>
            {open ? (
              <div className="divide-y divide-border border-t border-border">
                {stats.map((stat) => (
                  <div key={stat.label} className={cellBg(stat)}>
                    <OverviewStatCell stat={stat} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border shadow-xs sm:grid-cols-3 sm:divide-x-[2px] sm:divide-y-0 sm:divide-[#A9B5C0] rtl:sm:divide-x-reverse">
            {stats.map((stat) => (
              <div key={stat.label} className={cellBg(stat)}>
                <OverviewStatCell stat={stat} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
