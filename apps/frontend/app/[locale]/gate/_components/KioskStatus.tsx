"use client";

import { Spinner } from "@vms/ui";
import { Link2Off, MonitorSmartphone } from "lucide-react";
import { useTranslations } from "next-intl";

export type KioskStatusKind = "checking" | "notSetUp" | "inactive";

/** Everything the kiosk shows instead of the scanner. */
export function KioskStatus({ kind }: { kind: KioskStatusKind }) {
  const t = useTranslations("gate.kiosk");
  if (kind === "checking") {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-fg-muted"
        role="status"
      >
        <Spinner />
        <span>{t("checking")}</span>
      </div>
    );
  }
  const Icon = kind === "inactive" ? Link2Off : MonitorSmartphone;
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <Icon className="size-9 stroke-[1.25] text-fg-muted" aria-hidden="true" />
      <h1 className="text-2xl font-bold text-balance text-fg">
        {t(`${kind}.title`)}
      </h1>
      <p className="max-w-md text-fg-muted">{t(`${kind}.body`)}</p>
    </section>
  );
}
