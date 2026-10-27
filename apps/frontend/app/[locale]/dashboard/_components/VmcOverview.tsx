"use client";

import { Button } from "@vms/ui";
import { Signal } from "lucide-react";
import { useTranslations } from "next-intl";
import { EvacuationRollLink } from "@/app/[locale]/_components/EvacuationIndicator";
import {
  OverviewBar,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";

export type { OverviewStat };

export interface VmcOverviewProps {
  welcome: string;
  stats: OverviewStat[];
  onRegisterWalkIn: () => void;
  onNewInvite: () => void;
  /** Above zero, the quick-actions panel turns red and links to the roll. */
  evacuationCount?: number;
}

function WelcomeHeader({ welcome }: { welcome: string }) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-tight text-success">
        <Signal className="size-4" aria-hidden="true" />
        {t("hub")}
      </span>
      <h1 className="text-[2rem] font-medium leading-tight text-[#344054]">
        {welcome}
      </h1>
    </div>
  );
}

function QuickActions({
  onRegisterWalkIn,
  onNewInvite,
  evacuationCount = 0,
}: Pick<
  VmcOverviewProps,
  "onRegisterWalkIn" | "onNewInvite" | "evacuationCount"
>) {
  const t = useTranslations("dashboard");
  return (
    <>
      <div className="relative flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/afreximbank.svg"
          alt=""
          className="size-12"
          aria-hidden="true"
        />
        <h3 className="text-lg font-semibold">{t("quickActions.title")}</h3>
        <EvacuationRollLink count={evacuationCount} />
      </div>
      <div className="relative flex flex-wrap items-center gap-3">
        <Button intent="primary" onClick={onRegisterWalkIn}>
          {t("quickActions.registerWalkIn")}
        </Button>
        <Button intent="accent" onClick={onNewInvite}>
          {t("quickActions.newInvite")}
        </Button>
      </div>
    </>
  );
}

export function VmcOverview({
  welcome,
  stats,
  onRegisterWalkIn,
  onNewInvite,
  evacuationCount = 0,
}: VmcOverviewProps) {
  const t = useTranslations("dashboard");
  return (
    <OverviewBar
      panelTone={evacuationCount > 0 ? "alert" : "default"}
      heading={<WelcomeHeader welcome={welcome} />}
      stats={stats}
      mobileStats="collapsible"
      collapsibleLabel={t("activity.title")}
      panel={
        <QuickActions
          onRegisterWalkIn={onRegisterWalkIn}
          onNewInvite={onNewInvite}
          evacuationCount={evacuationCount}
        />
      }
    />
  );
}
