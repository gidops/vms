"use client";

import type { GateVerdict } from "@vms/contracts";
import { Avatar, Button, cn } from "@vms/ui";
import {
  CalendarX2,
  CircleCheck,
  CircleX,
  Hourglass,
  SearchX,
  UserCheck,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Field } from "@/app/[locale]/_components/visit-detail/helpers";
import type { GateResult as GateResultData } from "@/data/gate/gate.api";
import { formatWatDateTime } from "@/shared/wat";

/** Seconds a result stays up before the kiosk returns to scanning. */
export const AUTO_RETURN_SECONDS = 30;

type Tone = "success" | "info" | "warning" | "danger";

const LOOK: Record<GateVerdict, { tone: Tone; icon: React.ReactNode }> = {
  VALID_TODAY: { tone: "success", icon: <CircleCheck /> },
  ALREADY_CHECKED_IN: { tone: "info", icon: <UserCheck /> },
  WRONG_DAY: { tone: "warning", icon: <CalendarX2 /> },
  NOT_CONFIRMED: { tone: "warning", icon: <Hourglass /> },
  CLOSED: { tone: "danger", icon: <CircleX /> },
  NOT_FOUND: { tone: "danger", icon: <SearchX /> },
};

const PANEL: Record<Tone, string> = {
  success: "bg-success-subtle",
  info: "bg-info-subtle",
  warning: "bg-warning-subtle",
  danger: "bg-danger-subtle",
};

/** Glyph-only icon in the verdict colour, SF Symbols-like: large and thin-stroked. */
const GLYPH: Record<Tone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-danger",
};

/** Big, colour-coded answer for the guard, then back to scanning. */
export function GateResult({
  result,
  onDone,
}: {
  result: GateResultData;
  onDone: () => void;
}) {
  const t = useTranslations("gate.result");
  const locale = useLocale();
  const { tone, icon } = LOOK[result.verdict];
  const visit = result.visit;
  const heading = React.useRef<HTMLHeadingElement>(null);
  const [left, setLeft] = React.useState(AUTO_RETURN_SECONDS);
  const [shownAt] = React.useState(() => Date.now());

  React.useEffect(() => heading.current?.focus(), []);

  React.useEffect(() => {
    const timer = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  React.useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);

  const when = visit?.scheduledAt
    ? formatWatDateTime(visit.scheduledAt, locale)
    : null;
  // Wrong day: say whether they're late or early, with the actual date.
  const dayLine =
    result.verdict === "WRONG_DAY" && visit?.scheduledAt && when
      ? new Date(visit.scheduledAt).getTime() < shownAt
        ? t("WRONG_DAY.past", { date: when })
        : t("WRONG_DAY.future", { date: when })
      : null;

  return (
    <section
      aria-live="assertive"
      className={cn(
        "flex flex-col items-center gap-5 rounded-2xl px-5 py-8 text-center sm:px-8",
        PANEL[tone],
      )}
    >
      <span
        className={cn("flex [&_svg]:size-9 [&_svg]:stroke-[1.25]", GLYPH[tone])}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-3xl font-bold text-balance text-fg outline-none"
      >
        {t(`${result.verdict}.title`)}
      </h2>
      {dayLine ? (
        <p className="text-xl font-semibold text-fg">{dayLine}</p>
      ) : null}
      <p className="max-w-lg text-lg text-fg-muted">
        {t(`${result.verdict}.body`)}
      </p>

      {visit ? (
        <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl border border-border bg-surface p-4 text-start">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={visit.visitorName} size="lg" />
            <div className="flex min-w-0 flex-col">
              <span className="text-lg font-semibold text-fg">
                {visit.visitorName}
              </span>
              {visit.organization ? (
                <span className="text-sm text-fg-muted">
                  {visit.organization}
                </span>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("visitDate")}>{when ?? "—"}</Field>
            <Field label={t("host")}>{visit.hostName ?? "—"}</Field>
          </div>
        </div>
      ) : null}

      <div className="flex w-full max-w-lg flex-col items-center gap-2">
        <Button intent="primary" size="lg" fullWidth onClick={onDone}>
          {t("scanNext")}
        </Button>
        <span className="text-sm text-fg-muted">
          {t("autoReturn", { seconds: Math.max(left, 0) })}
        </span>
      </div>
    </section>
  );
}
