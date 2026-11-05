"use client";

import { CalendarDays, Clock } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import type * as React from "react";
import { LanguageSwitcher } from "@/app/[locale]/_components/LanguageSwitcher";
import { Countdown } from "./Countdown";

export function Header({ children }: { children?: React.ReactNode }) {
  const t = useTranslations("selfRegister");
  return (
    <header className="flex flex-col gap-3 bg-emphasis px-5 pt-4 pb-5 text-emphasis-fg">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/afreximbank.svg" alt="" className="size-8" />
        <span className="text-sm font-semibold">{t("brand")}</span>
        <span className="ms-auto">
          <LanguageSwitcher />
        </span>
      </div>
      {children}
    </header>
  );
}

/** Title, today's date and, once the form is open, its timer. */
export function FormHeading({
  timer,
}: {
  timer?: { deadline: number; onExpire: () => void };
}) {
  const t = useTranslations("selfRegister");
  const format = useFormatter();
  const now = useNow();
  const today = format.dateTime(now, {
    weekday: "long",
    day: "numeric",
    month: "long",
    // "Today" is the building's day, whatever zone the phone is set to.
    timeZone: "Africa/Lagos",
  });
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-emphasis-fg/75">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden="true" />
          {t("today", { date: today })}
        </span>
        {timer ? (
          <Countdown
            key={timer.deadline}
            deadline={timer.deadline}
            onExpire={timer.onExpire}
            template="expiresIn"
            className="inline-flex items-center gap-1.5"
            icon={<Clock className="size-4" aria-hidden="true" />}
          />
        ) : null}
      </span>
    </div>
  );
}
