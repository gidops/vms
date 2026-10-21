"use client";

import { PERMISSIONS } from "@vms/contracts";
import { Button } from "@vms/ui";
import {
  Download,
  LifeBuoy,
  MailCheck,
  QrCode,
  SquareActivity,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import {
  OverviewBar,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";
import { ExportVisitorsDialog } from "@/app/[locale]/_components/ExportVisitorsDialog";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";

export type { OverviewStat };

export interface VmcOverviewProps {
  /** Welcome heading, e.g. "Welcome Judith Francis". Rendered inside the bar. */
  welcome: string;
  stats: OverviewStat[];
  onRegisterWalkIn: () => void;
  onNewInvite: () => void;
}

/** "VMC HUB" eyebrow + welcome heading — the bar's white top row. */
function WelcomeHeader({ welcome }: { welcome: string }) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-tight text-success">
        <SquareActivity className="size-4" aria-hidden="true" />
        {t("hub")}
      </span>
      <h1 className="text-4xl font-semibold text-fg">{welcome}</h1>
    </div>
  );
}

/** The brand-green quick-actions content (logo, title, action buttons). */
function QuickActions({
  onRegisterWalkIn,
  onNewInvite,
}: Pick<VmcOverviewProps, "onRegisterWalkIn" | "onNewInvite">) {
  const t = useTranslations("dashboard");
  const { hasPermission } = useAuth();
  const canEvacuation = hasPermission(PERMISSIONS.EVACUATION_READ);
  const canOptIns = hasPermission(PERMISSIONS.CONSENT_READ);
  const canDeskQr = hasPermission(PERMISSIONS.ISSUER_READ);
  // V1 parity: reception keeps the visitor export (report:export).
  const canExport = hasPermission(PERMISSIONS.REPORT_EXPORT);
  const [exportOpen, setExportOpen] = React.useState(false);
  return (
    <>
      <div className="relative flex flex-col gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/afreximbank.svg"
          alt=""
          className="size-8"
          aria-hidden="true"
        />
        <h3 className="text-lg font-semibold">{t("quickActions.title")}</h3>
      </div>
      <div className="relative flex flex-wrap items-center gap-3">
        <Button intent="primary" onClick={onRegisterWalkIn}>
          {t("quickActions.registerWalkIn")}
        </Button>
        <Button intent="accent" onClick={onNewInvite}>
          {t("quickActions.newInvite")}
        </Button>
        {canEvacuation ? (
          <Button asChild intent="accent" tone="outline">
            <Link href="/dashboard/evacuation">
              <LifeBuoy className="size-4" aria-hidden="true" />
              {t("quickActions.evacuation")}
            </Link>
          </Button>
        ) : null}
        {canOptIns ? (
          <Button asChild intent="accent" tone="outline">
            <Link href="/dashboard/opt-ins">
              <MailCheck className="size-4" aria-hidden="true" />
              {t("quickActions.optIns")}
            </Link>
          </Button>
        ) : null}
        {canDeskQr ? (
          <Button asChild intent="accent" tone="outline">
            <Link href="/dashboard/desk-qr">
              <QrCode className="size-4" aria-hidden="true" />
              {t("quickActions.deskQr")}
            </Link>
          </Button>
        ) : null}
        {canExport ? (
          <Button
            intent="accent"
            tone="outline"
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" aria-hidden="true" />
            {t("quickActions.export")}
          </Button>
        ) : null}
      </div>
      {canExport ? (
        <ExportVisitorsDialog open={exportOpen} onOpenChange={setExportOpen} />
      ) : null}
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
}: VmcOverviewProps) {
  const t = useTranslations("dashboard");
  return (
    <OverviewBar
      heading={<WelcomeHeader welcome={welcome} />}
      stats={stats}
      mobileStats="collapsible"
      collapsibleLabel={t("activity.title")}
      panel={
        <QuickActions
          onRegisterWalkIn={onRegisterWalkIn}
          onNewInvite={onNewInvite}
        />
      }
    />
  );
}
