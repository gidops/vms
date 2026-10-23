import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VisitAlert } from "@/data/visits/visits.api";

/**
 * The red banner at the top of the sheet when a security alert is open:
 * "Security Review Required" (flag / restricted match) or "Additional
 * Information Required" (more-info request).
 */
export function AlertStripe({ alert }: { alert: VisitAlert }) {
  const t = useTranslations("requests");
  const label =
    alert.type === "ADDITIONAL_INFO"
      ? t("stripe.additionalInfo")
      : t("stripe.securityReview");
  return (
    <div className="flex items-center gap-2 rounded-lg bg-danger-subtle p-3 text-sm font-semibold text-danger">
      <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
