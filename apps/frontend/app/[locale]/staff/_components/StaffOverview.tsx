"use client";

import { Button } from "@vms/ui";
import { CalendarCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  OverviewBar,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";

export type StaffStat = OverviewStat;

export interface StaffOverviewProps {
  welcome: string;
  stats: StaffStat[];
  office?: string | null;
  onNewInvite: () => void;
}

/** Always shown; "Not set" until the host picks a desk in Settings → My Desk. */
function OfficeFloor({ office }: { office?: string | null }) {
  const t = useTranslations("staff");
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-lg font-semibold text-[#00736E]">
        {t("overview.officeFloor")}:
      </span>
      {office ? (
        <span className="text-xl font-bold uppercase tracking-tight text-[#FF6900]">
          {office}
        </span>
      ) : (
        <span className="text-base text-fg-muted">
          {t("overview.officeFloorUnset")}
        </span>
      )}
    </div>
  );
}

function BookPanel({ onNewInvite }: Pick<StaffOverviewProps, "onNewInvite">) {
  const t = useTranslations("staff");
  return (
    <>
      <div className="relative flex flex-col gap-2">
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

/** The office floor sits above the booking panel so it reads as that column's heading. */
export function StaffOverview({
  welcome,
  stats,
  office,
  onNewInvite,
}: StaffOverviewProps) {
  const t = useTranslations("staff");
  return (
    <OverviewBar
      heading={
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-tight text-success">
            <CalendarCheck className="size-4" aria-hidden="true" />
            {t("hub")}
          </span>
          <h1 className="text-[2rem] font-medium leading-tight text-[#344054]">
            {welcome}
          </h1>
        </div>
      }
      aside={<OfficeFloor office={office} />}
      stats={stats}
      panel={<BookPanel onNewInvite={onNewInvite} />}
    />
  );
}
