"use client";

import { Alert, Button, Input, Label } from "@vms/ui";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { Countdown } from "./Countdown";

/** Reception reads the visitor a 6-digit code to finish. */
export function CodeStep({
  code,
  onCodeChange,
  banner,
  busy,
  deadline,
  onExpire,
  onSubmit,
}: {
  code: string;
  onCodeChange: (code: string) => void;
  banner: string | null;
  busy: boolean;
  deadline: number;
  onExpire: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const t = useTranslations("selfRegister");
  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex flex-1 flex-col items-center gap-4 px-6 py-10 text-center"
    >
      <span
        className="flex size-18 items-center justify-center rounded-full bg-info-subtle text-info [&_svg]:size-9"
        aria-hidden="true"
      >
        <Clock />
      </span>
      <h2 className="text-2xl font-bold text-fg">{t("code.title")}</h2>
      <p className="max-w-xs text-fg-muted">{t("code.body")}</p>
      {banner ? (
        <Alert intent="danger" className="w-full text-start">
          <span>{banner}</span>
        </Alert>
      ) : null}
      <Label htmlFor="sr-code" className="sr-only">
        {t("code.label")}
      </Label>
      <Input
        id="sr-code"
        value={code}
        onChange={(e) =>
          onCodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))
        }
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="••••••"
        dir="ltr"
        className="h-14 max-w-60 text-center font-mono text-3xl tracking-[0.5em]"
      />
      <Button
        type="submit"
        intent="primary"
        size="lg"
        className="w-full max-w-sm"
        disabled={busy || code.length !== 6}
        aria-busy={busy || undefined}
      >
        {t("code.confirm")}
      </Button>
      <Countdown
        key={deadline}
        deadline={deadline}
        template="code.expires"
        onExpire={onExpire}
        className="text-sm text-fg-muted"
      />
    </form>
  );
}
