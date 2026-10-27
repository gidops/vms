import { Badge } from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import type { HeldRfidCard } from "@/data/visits/visits.api";

/** The visitor's held RFID card; warning tone once it's past its valid-until date. */
export function RfidCardBadge({
  card,
  size = "sm",
}: {
  card: HeldRfidCard;
  size?: "sm" | "md";
}) {
  const t = useTranslations("rfidCard");
  const format = useFormatter();
  return (
    <Badge
      intent={card.overdue ? "warning" : "neutral"}
      tone="soft"
      size={size}
      title={t("validUntil", {
        date: format.dateTime(new Date(card.validUntil), {
          dateStyle: "medium",
        }),
      })}
    >
      <span dir="ltr">{t("badge", { number: card.cardNumber })}</span>
      {card.overdue ? <span>· {t("overdue")}</span> : null}
    </Badge>
  );
}
