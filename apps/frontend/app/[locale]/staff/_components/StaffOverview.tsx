"use client";

import { Button } from "@vms/ui";
import { CalendarCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  OverviewBar,
  OverviewEyebrow,
  PANEL_ACTION,
  PANEL_ACTIONS,
  PanelActionLabel,
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
      <div className={PANEL_ACTIONS}>
        <Button
          intent="accent"
          className={PANEL_ACTION}
          aria-label={t("overview.newInvite")}
          onClick={onNewInvite}
        >
          <PanelActionLabel
            label={t("overview.newInvite")}
            short={t("overview.newInviteShort")}
          />
        </Button>
      </div>
    </>
  );
}

/** Mobile eyebrow: just the floor, which is what a host checks at a glance. */
function OfficeFloorValue({ office }: { office?: string | null }) {
  const t = useTranslations("staff");
  return office ? (
    <span className="text-base font-bold uppercase tracking-tight text-[#FF6900]">
      {office}
    </span>
  ) : (
    <span className="text-base text-fg-muted">
      {t("overview.officeFloor")}: {t("overview.officeFloorUnset")}
    </span>
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
      eyebrow={
        <OverviewEyebrow icon={CalendarCheck}>{t("hub")}</OverviewEyebrow>
      }
      mobileEyebrow={<OfficeFloorValue office={office} />}
      welcome={welcome}
      aside={<OfficeFloor office={office} />}
      stats={stats}
      panel={<BookPanel onNewInvite={onNewInvite} />}
    />
  );
}
