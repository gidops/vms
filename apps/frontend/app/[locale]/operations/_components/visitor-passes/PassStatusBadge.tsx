"use client";

import type { VisitorPassStatus } from "@vms/contracts";
import { Badge } from "@vms/ui";
import { useTranslations } from "next-intl";

const STATUS_INTENT: Record<VisitorPassStatus, "success" | "info" | "neutral"> =
  {
    AVAILABLE: "success",
    IN_USE: "info",
    RETIRED: "neutral",
  };

export function PassStatusBadge({ status }: { status: VisitorPassStatus }) {
  const t = useTranslations("operations.visitorPasses.status");
  return <Badge intent={STATUS_INTENT[status]}>{t(status)}</Badge>;
}
