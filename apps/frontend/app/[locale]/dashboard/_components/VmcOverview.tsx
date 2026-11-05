"use client";

import { Button } from "@vms/ui";
import { Signal } from "lucide-react";
import { useTranslations } from "next-intl";
import { EvacuationRollLink } from "@/app/[locale]/_components/EvacuationIndicator";
import {
  OverviewBar,
  OverviewEyebrow,
  PANEL_ACTION,
  PANEL_ACTIONS,
  PanelActionLabel,
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
      <div className={PANEL_ACTIONS}>
        <Button
          intent="primary"
          className={PANEL_ACTION}
          aria-label={t("quickActions.registerWalkIn")}
          onClick={onRegisterWalkIn}
        >
          <PanelActionLabel
            label={t("quickActions.registerWalkIn")}
            short={t("quickActions.registerWalkInShort")}
          />
        </Button>
        <Button
          intent="accent"
          className={PANEL_ACTION}
          aria-label={t("quickActions.newInvite")}
          onClick={onNewInvite}
        >
          <PanelActionLabel
            label={t("quickActions.newInvite")}
            short={t("quickActions.newInviteShort")}
          />
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
      eyebrow={<OverviewEyebrow icon={Signal}>{t("hub")}</OverviewEyebrow>}
      welcome={welcome}
      stats={stats}
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
