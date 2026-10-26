"use client";

import { PERMISSIONS } from "@vms/contracts";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEvacuationRoll } from "@/data/evacuation/queries";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";

/**
 * Visitors on the live Evacuation Roll, for the home-screen quick-actions
 * panels. Zero (and no request) for roles without `evacuation:read`.
 */
export function useEvacuationAlertCount(): number {
  const { hasPermission } = useAuth();
  const roll = useEvacuationRoll({
    enabled: hasPermission(PERMISSIONS.EVACUATION_READ),
  });
  return roll.data?.count ?? 0;
}

/**
 * "3 need evacuation help · View roll →" under a quick-actions title, shown
 * while the panel is tinted (see `OverviewBar` `panelTone="alert"`).
 */
export function EvacuationRollLink({ count }: { count: number }) {
  const t = useTranslations("evacuation.indicator");
  return (
    // Polite: the roll refreshes every minute and shouldn't interrupt.
    <div aria-live="polite">
      {count > 0 ? (
        <Link
          href={{ pathname: "/insights", query: { tab: "evacuation" } }}
          className="inline-flex items-center gap-1.5 rounded-sm text-sm text-emphasis-fg/90 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <LifeBuoy className="size-4 shrink-0" aria-hidden="true" />
          {t("count", { count })}
          {" · "}
          {t("viewRoll")}
          <ArrowRight
            className="size-3.5 shrink-0 rtl:-scale-x-100"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
}
