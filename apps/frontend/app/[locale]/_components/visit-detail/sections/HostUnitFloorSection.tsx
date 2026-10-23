import { Avatar } from "@vms/ui";
import { Hash } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import { SheetSection } from "./SheetSection";

/**
 * The VMC/admin "Host/Unit/Floor Details" card shown above Guest Information: a
 * teal row with the requesting host + designation, and a gold floor row.
 */
export function HostUnitFloorSection({ data }: { data: VisitRequestDetail }) {
  const t = useTranslations("requests");
  const host = data.host;
  return (
    <SheetSection title={t("sections.hostDetails")}>
      <div className="overflow-hidden rounded-lg">
        <div className="flex items-center gap-3 bg-emphasis p-4 text-emphasis-fg">
          <Avatar name={host?.user.fullName ?? "—"} size="md" />
          <div className="flex flex-col">
            <span className="font-semibold">{host?.user.fullName ?? "—"}</span>
            {host?.department ? (
              <span className="text-sm text-emphasis-muted">
                {host.department}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 bg-accent/15 p-3 text-sm font-semibold text-accent-fg">
          <Hash className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="text-fg-subtle">{t("sections.floor")}:</span>
          <span className="text-warning">{data.floor ?? "—"}</span>
        </div>
      </div>
    </SheetSection>
  );
}
