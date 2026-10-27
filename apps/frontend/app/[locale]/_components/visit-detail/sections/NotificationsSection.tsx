"use client";

import { PERMISSIONS, type NotificationDelivery } from "@vms/contracts";
import { Badge, Button, Spinner } from "@vms/ui";
import { Mail, MessageCircle, MessageSquare, RotateCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useRetryDelivery,
  useVisitDeliveries,
} from "@/data/deliveries/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { WAT_TIME_ZONE, watDateLocale } from "@/shared/wat";
import { SheetSection } from "./SheetSection";

const CHANNEL_ICON = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: MessageSquare,
} as const;

/** Map a backend template key to its i18n label key. */
export function templateLabelKey(templateKey: string): string {
  switch (templateKey) {
    case "visit.approved":
      return "inviteCode";
    case "visitor.arrived":
      return "visitorArrived";
    case "visit.thank_you":
      return "thankYou";
    default:
      return "other";
  }
}

/** "Sent" means the provider accepted it; there are no delivery receipts, so never claim "Delivered". */
export const STATUS_INTENT = {
  SENT: "info",
  PENDING: "neutral",
  FAILED: "danger",
} as const;

function DeliveryRow({
  d,
  onRetry,
  canRetry,
  retrying,
}: {
  d: NotificationDelivery;
  onRetry: (id: string) => void;
  canRetry: boolean;
  retrying: boolean;
}) {
  const t = useTranslations("delivery");
  const locale = useLocale();
  const Icon = CHANNEL_ICON[d.channel];
  const when = d.sentAt ?? d.createdAt;
  const time = new Intl.DateTimeFormat(watDateLocale(locale), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: WAT_TIME_ZONE,
  }).format(new Date(when));
  const failed = d.status === "FAILED";

  return (
    <li className="flex items-start gap-3 border-t border-border py-3 first:border-t-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm">
          <span className="font-semibold text-fg">
            {t(`channel.${d.channel}`)}
          </span>
          <span className="text-fg-muted">
            {" · "}
            {t(`template.${templateLabelKey(d.templateKey)}`)}
          </span>
        </span>
        <span className="truncate text-sm text-fg-muted" dir="auto">
          {[d.recipientMasked, time].filter(Boolean).join(" · ")}
        </span>
        {failed ? (
          <span className="text-sm text-danger">
            {[d.error, t("attempts", { count: d.attempts })]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge intent={STATUS_INTENT[d.status]} tone="soft" dot>
          {t(`status.${d.status}`)}
        </Badge>
        {failed && canRetry ? (
          <Button
            intent="primary"
            tone="outline"
            size="sm"
            onClick={() => onRetry(d.id)}
            disabled={retrying}
            aria-busy={retrying || undefined}
          >
            <RotateCw className="size-4" aria-hidden="true" />
            {t("retry")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** Rendered only for holders of notification:read. */
export function NotificationsSection({ visitId }: { visitId: string }) {
  const t = useTranslations("delivery");
  const { hasPermission } = useAuth();
  const canRetry = hasPermission(PERMISSIONS.NOTIFICATION_RETRY);
  const deliveries = useVisitDeliveries(visitId);
  const retry = useRetryDelivery(visitId);
  const rows = deliveries.data ?? [];
  const failedCount = rows.filter((d) => d.status === "FAILED").length;

  return (
    <SheetSection
      title={
        <span className="inline-flex items-center gap-2">
          {t("title")}
          {failedCount > 0 ? (
            <Badge intent="danger" tone="outline" size="sm">
              {t("failedCount", { count: failedCount })}
            </Badge>
          ) : null}
        </span>
      }
    >
      {deliveries.isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : deliveries.isError ? (
        <p role="alert" className="text-sm text-danger">
          {t("loadError")}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-fg-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((d) => (
            <DeliveryRow
              key={d.id}
              d={d}
              canRetry={canRetry}
              retrying={retry.isPending && retry.variables === d.id}
              onRetry={(id) => retry.mutate(id)}
            />
          ))}
        </ul>
      )}
      {retry.isError ? (
        <p role="alert" className="text-sm text-danger">
          {t("retryError")}
        </p>
      ) : null}
    </SheetSection>
  );
}
