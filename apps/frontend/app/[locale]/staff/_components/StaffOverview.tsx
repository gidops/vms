"use client";

import { Button } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";

export interface StaffStat {
  label: string;
  value: React.ReactNode;
}

export interface StaffOverviewProps {
  /** Welcome heading, e.g. "Welcome Judith Francis". Spans the stat columns. */
  welcome: string;
  stats: StaffStat[];
  /** Host's office/floor; shown top-right, above the book panel. Hidden when absent. */
  office?: string | null;
  onNewInvite: () => void;
}

/**
 * "Office Floor: 3RD FLOOR — LW" — teal label over an orange value, left-aligned
 * in the right column above the book panel. Renders nothing without an office.
 */
function OfficeFloor({ office }: { office?: string | null }) {
  const t = useTranslations("staff");
  if (!office) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-lg font-semibold text-[#00736e]">
        {t("overview.officeFloor")}:
      </span>
      <span className="text-xl font-bold uppercase tracking-tight text-[#ff6900]">
        {office}
      </span>
    </div>
  );
}

/**
 * Decorative nested chevrons bleeding off the top-right corner of the green
 * panel — a subtle brand watermark (matches the Figma design, node 672:40380).
 *
 * The SVG fills the panel and uses a `0 0 449 149` viewBox (the design panel's
 * own coordinate space) with `xMaxYMin slice`, so the chevrons stay pinned to
 * the top-right corner and scale with the panel at any width/height. The paths
 * are drawn at the exact design coordinates and intentionally extend past the
 * viewBox (negative Y / x > 449) so they bleed off the top and right edges,
 * clipped by the panel's `overflow-hidden`.
 */
function DecorChevrons() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 449 149"
      preserveAspectRatio="xMaxYMin slice"
      className="pointer-events-none absolute inset-0 h-full w-full text-emphasis-fg/[0.07] rtl:-scale-x-100"
      fill="none"
      stroke="currentColor"
      strokeWidth="17"
      strokeLinejoin="round"
    >
      <path d="M287 -15 L387 65 L487 -15" />
      <path d="M287 -52 L387 28 L487 -52" />
      <path d="M287 -89 L387 -9 L487 -89" />
    </svg>
  );
}

/** The brand-green "book guests" panel: title + invite action. */
function BookPanel({ onNewInvite }: Pick<StaffOverviewProps, "onNewInvite">) {
  const t = useTranslations("staff");
  return (
    <>
      <DecorChevrons />
      <div className="relative flex flex-col gap-3">
        <h3 className="whitespace-pre-line text-lg font-semibold">
          {t("overview.bookTitle")}
        </h3>
      </div>
      <div className="relative flex flex-wrap items-center gap-3">
        <Button intent="accent" onClick={onNewInvite}>
          {t("overview.newInvite")}
        </Button>
      </div>
    </>
  );
}

function StatCell({ stat }: { stat: StaffStat }) {
  return (
    <div className="flex flex-col gap-4 p-8">
      <span className="text-xl font-semibold text-[#858d9d]">{stat.label}</span>
      <span className="text-[48px] font-bold leading-none text-[#383e49]">
        {stat.value}
      </span>
    </div>
  );
}

/**
 * Staff "Today's Schedule" overview, rendered as one unified bar:
 *   row 1 — welcome heading (spans the stat columns) | office floor
 *   row 2 — three stat cells                         | brand-green book panel
 * The office floor and book panel share the trailing column, so the floor reads
 * as a heading for the "book visitors" call to action beneath it. On mobile the
 * pieces stack: heading, book panel, then the stats.
 */
export function StaffOverview({
  welcome,
  stats,
  office,
  onNewInvite,
}: StaffOverviewProps) {
  return (
    <>
      {/* ── Desktop: welcome/office + stats/book-panel in one bar ─────────── */}
      {/* Book-panel column fr (1.5) MUST stay in sync with the records grid's
          right column in staff/page.tsx, so Recent Updates lines up under it. */}
      <div className="hidden overflow-hidden rounded-xl border border-border shadow-xs lg:grid lg:grid-cols-[repeat(3,1fr)_minmax(300px,1.5fr)]">
        {/* Row 1 */}
        <div className="col-span-3 flex items-center bg-white px-6 py-5">
          <h1 className="text-3xl font-semibold text-[#383e49]">{welcome}</h1>
        </div>
        <div className="flex flex-col justify-center border-s border-border bg-[#faf9f9] px-6 py-5">
          <OfficeFloor office={office} />
        </div>

        {/* Row 2 */}
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={
              "border-t border-border bg-primary-subtle" +
              (i > 0 ? " border-s" : "")
            }
          >
            <StatCell stat={stat} />
          </div>
        ))}
        <div className="relative flex flex-col justify-between gap-6 overflow-hidden border-s border-t border-border bg-[#005652] p-6 text-emphasis-fg">
          <BookPanel onNewInvite={onNewInvite} />
        </div>
      </div>

      {/* ── Mobile: heading, book panel, then stats ───────────────────────── */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-[#383e49]">{welcome}</h1>
          <OfficeFloor office={office} />
        </div>
        <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-xl bg-[#005652] p-6 text-emphasis-fg">
          <BookPanel onNewInvite={onNewInvite} />
        </div>
        <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-primary-subtle shadow-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
          {stats.map((stat) => (
            <StatCell key={stat.label} stat={stat} />
          ))}
        </div>
      </div>
    </>
  );
}
