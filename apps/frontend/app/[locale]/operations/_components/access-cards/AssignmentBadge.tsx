"use client";

import { Badge } from "@vms/ui";
import { useTranslations } from "next-intl";
import type { AssignmentItem } from "@/data/rfid-cards/rfid-cards.api";
import { watTodayIso } from "@/shared/wat";
import { splitWat } from "./wat-input";

/** Where a card issue stands: active / ends today / overdue / returned / lost. */
export function AssignmentBadge({
  item,
  now = new Date(),
}: {
  item: Pick<AssignmentItem, "status" | "overdue" | "validUntil">;
  now?: Date;
}) {
  const t = useTranslations("operations.accessCards.status");
  if (item.status === "RETURNED") {
    return <Badge intent="neutral">{t("returned")}</Badge>;
  }
  if (item.status === "LOST") return <Badge intent="danger">{t("lost")}</Badge>;
  if (item.overdue) return <Badge intent="danger">{t("overdue")}</Badge>;
  if (splitWat(item.validUntil).date === watTodayIso(now)) {
    return <Badge intent="warning">{t("endsToday")}</Badge>;
  }
  return <Badge intent="success">{t("active")}</Badge>;
}
