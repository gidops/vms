"use client";

import type { VisitStatus } from "@vms/contracts";
import { StatusBadge } from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";

/** Owns its own interval so only this cell re-renders each second. */
function OnsiteElapsed({ since }: { since: string }) {
  const t = useTranslations("staff");
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const totalSec = Math.max(
    0,
    Math.floor((now - new Date(since).getTime()) / 1000),
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(Math.floor(totalSec / 3600))}:${pad(
    Math.floor((totalSec % 3600) / 60),
  )}:${pad(totalSec % 60)}`;
  return (
    <span className="text-xs text-fg-muted">{t("onsiteFor", { time })}</span>
  );
}

export interface StatusCellProps {
  status: VisitStatus;
  scheduledAt?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  createdAt?: string | null;
}

/** Status badge with a status-specific subtext line (arrival, onsite duration, checkout time…). */
export function StatusCell({
  status,
  scheduledAt,
  checkInAt,
  checkOutAt,
  createdAt,
}: StatusCellProps) {
  const t = useTranslations("staff");
  const format = useFormatter();

  const timeLabel = (iso?: string | null) =>
    iso ? (
      <span className="text-xs text-fg-muted">
        {format.dateTime(new Date(iso), { timeStyle: "short" })}
      </span>
    ) : null;

  let sub: React.ReactNode = null;
  if (status === "PENDING") {
    sub = (
      <span className="text-xs text-fg-muted">{t("statusSub.fromSm")}</span>
    );
  } else if (status === "APPROVED") {
    sub = timeLabel(scheduledAt);
  } else if (status === "CHECKED_IN") {
    sub = checkInAt ? <OnsiteElapsed since={checkInAt} /> : null;
  } else if (status === "CHECKED_OUT") {
    sub = timeLabel(checkOutAt);
  } else {
    sub = timeLabel(scheduledAt ?? createdAt);
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge status={status} />
      {sub}
    </span>
  );
}
