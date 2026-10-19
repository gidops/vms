"use client";

import { Button } from "@vms/ui";
import { useTranslations } from "next-intl";
import {
  OverviewBar,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";

export type StaffStat = OverviewStat;

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
      <span className="text-lg font-semibold text-primary">
        {t("overview.officeFloor")}:
      </span>
      <span className="text-xl font-bold uppercase tracking-tight text-warning">
        {office}
      </span>
    </div>
  );
}

/** The brand-green "book visitors" panel: title + invite action. */
function BookPanel({ onNewInvite }: Pick<StaffOverviewProps, "onNewInvite">) {
  const t = useTranslations("staff");
  return (
    <>
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

/**
 * Staff "Today's Schedule" overview on the shared {@link OverviewBar}:
 *   row 1 — welcome heading (spans the stat columns) | office floor
 *   row 2 — three stat cells                         | book panel
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
    <OverviewBar
      heading={<h1 className="text-4xl font-semibold text-fg">{welcome}</h1>}
      aside={<OfficeFloor office={office} />}
      stats={stats}
      panel={<BookPanel onNewInvite={onNewInvite} />}
    />
  );
}
