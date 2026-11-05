"use client";

import type { PublicRegistrationResult } from "@vms/contracts";
import { CircleCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Centered } from "./StatusScreen";

export function DoneStep({ result }: { result: PublicRegistrationResult }) {
  const t = useTranslations("selfRegister");
  const format = useFormatter();
  return (
    <Centered icon={<CircleCheck />} tone="success" title={t("done.title")}>
      <p className="max-w-xs text-fg-muted">{t("done.body")}</p>
      <dl className="grid w-full max-w-sm grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-xl border border-border p-4 text-start text-sm">
        <dt className="text-fg-muted">{t("done.name")}</dt>
        <dd className="font-medium text-fg">{result.fullName}</dd>
        {result.hostName ? (
          <>
            <dt className="text-fg-muted">{t("done.visiting")}</dt>
            <dd className="font-medium text-fg">{result.hostName}</dd>
          </>
        ) : null}
        <dt className="text-fg-muted">{t("done.when")}</dt>
        <dd className="font-medium text-fg">
          {format.dateTime(new Date(result.visitDate), {
            dateStyle: "medium",
            // The visit day is the building's day, whatever zone the phone is set to.
            timeZone: "Africa/Lagos",
          })}
        </dd>
      </dl>
    </Centered>
  );
}
