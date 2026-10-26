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
  /** Welcome heading, e.g. "Welcome Judith Francis". Rendered inside the bar. */
  welcome: string;
  stats: OverviewStat[];
  onRegisterWalkIn: () => void;
  onNewInvite: () => void;
  /**
   * Visitors on the live Evacuation Roll. Above zero, the quick-actions panel
   * takes a muted red tint and links to the roll.
   */
  evacuationCount?: number;
}

/** "VMC HUB" eyebrow + welcome heading — the bar's white top row. */
function WelcomeHeader({ welcome }: { welcome: string }) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-tight text-success">
        <Signal className="size-4" aria-hidden="true" />
        {t("hub")}
      </span>
      <h1 className="text-[2rem] font-medium text-[#344054]">{welcome}</h1>
    </div>
  );
}

/** The brand-green quick-actions content (logo, title, action buttons). */
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

/**
 * VMC dashboard overview on the shared {@link OverviewBar}:
 *   row 1 — "VMC HUB" eyebrow + welcome heading (full width, white)
 *   row 2 — three stat cells | brand-green quick-actions panel
 * Mobile: welcome heading, quick-actions panel, then the stats in a
 * collapsible "View your activity" section.
 */
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
