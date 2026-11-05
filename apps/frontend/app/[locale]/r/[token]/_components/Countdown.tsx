"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { formatCountdown, secondsUntil } from "../self-registration";

/**
 * The only part of the page that re-renders every second. `deadline` is on the
 * `performance.now()` clock (see `deadlineOf`), so the phone's time is ignored.
 */
export function Countdown({
  deadline,
  template,
  onExpire,
  className,
  icon,
}: {
  deadline: number;
  template: "expiresIn" | "code.expires";
  onExpire: () => void;
  className?: string;
  icon?: React.ReactNode;
}) {
  const t = useTranslations("selfRegister");
  const [left, setLeft] = React.useState(() => secondsUntil(deadline));

  React.useEffect(() => {
    const id = setInterval(() => setLeft(secondsUntil(deadline)), 1_000);
    return () => clearInterval(id);
  }, [deadline]);

  const expire = React.useRef(onExpire);
  React.useEffect(() => {
    expire.current = onExpire;
  });
  React.useEffect(() => {
    if (left === 0) expire.current();
  }, [left]);

  return (
    <>
      <span className={className} aria-live="off">
        {icon}
        {t(template, { countdown: formatCountdown(left) })}
      </span>
      {/* Announced once: the text appears at one minute and then stays the same. */}
      <span className="sr-only" role="status" aria-live="polite">
        {left > 0 && left <= 60 ? t("oneMinuteLeft") : ""}
      </span>
    </>
  );
}
