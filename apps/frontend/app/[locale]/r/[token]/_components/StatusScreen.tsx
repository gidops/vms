"use client";

import { Button, Spinner, cn } from "@vms/ui";
import { Clock, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

export function Centered({
  icon,
  tone,
  title,
  focusTitle,
  children,
}: {
  icon: React.ReactNode;
  tone: "success" | "warning" | "info";
  title: string;
  /** Moves focus to the heading on mount, e.g. when the timer ran out under the visitor. */
  focusTitle?: boolean;
  children?: React.ReactNode;
}) {
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (focusTitle) heading.current?.focus();
  }, [focusTitle]);
  return (
    <section className="flex flex-1 flex-col items-center gap-4 px-6 py-12 text-center">
      <span
        className={cn(
          "flex size-18 items-center justify-center rounded-full [&_svg]:size-9",
          tone === "success" && "bg-success-subtle text-success",
          tone === "warning" && "bg-warning-subtle text-warning",
          tone === "info" && "bg-info-subtle text-info",
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-2xl font-bold text-balance text-fg outline-none"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export type StatusKind = "opening" | "inactive" | "expired";

/** Every screen that is not the form or the reference. */
export function StatusScreen({
  kind,
  message,
  focusTitle,
  onStartAgain,
}: {
  kind: StatusKind;
  /** Overrides the default explanation on the expired screen. */
  message?: string | null;
  focusTitle?: boolean;
  onStartAgain: () => void;
}) {
  const t = useTranslations("selfRegister");
  if (kind === "opening") {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (kind === "inactive") {
    return (
      <Centered icon={<QrCode />} tone="warning" title={t("inactive.title")}>
        <p className="max-w-xs text-fg-muted">{t("inactive.body")}</p>
      </Centered>
    );
  }
  return (
    <Centered
      icon={<Clock />}
      tone="warning"
      title={t(`${kind}.title`)}
      focusTitle={focusTitle}
    >
      <p className="max-w-xs text-fg-muted">{message ?? t(`${kind}.body`)}</p>
      <Button intent="primary" size="lg" onClick={onStartAgain}>
        {t("startAgain")}
      </Button>
    </Centered>
  );
}
