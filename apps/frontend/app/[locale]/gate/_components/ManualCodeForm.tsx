"use client";

import { REFERENCE_CODE_RE, normalizeReferenceCode } from "@vms/contracts";
import { Button, Input, Label } from "@vms/ui";
import { Keyboard } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

/** Fallback when the camera can't read the QR: the same code is printed in the invitation email. */
export function ManualCodeForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (code: string) => void;
}) {
  const t = useTranslations("gate.manual");
  const [value, setValue] = React.useState("");
  const [invalid, setInvalid] = React.useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeReferenceCode(value);
    if (!REFERENCE_CODE_RE.test(code)) return setInvalid(true);
    setValue(code);
    onSubmit(code);
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted"
          aria-hidden="true"
        >
          <Keyboard className="size-5" />
        </span>
        <div className="flex flex-col">
          <h2 className="font-semibold text-fg">{t("title")}</h2>
          <p className="text-sm text-fg-muted">{t("body")}</p>
        </div>
      </div>
      <Label htmlFor="gate-code" className="sr-only">
        {t("label")}
      </Label>
      <Input
        id="gate-code"
        value={value}
        onChange={(e) => {
          setInvalid(false);
          setValue(e.target.value.toUpperCase().slice(0, 12));
        }}
        placeholder="ABCD-123"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        dir="ltr"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "gate-code-error" : undefined}
        className="h-14 text-center font-mono text-3xl tracking-[0.2em]"
      />
      {invalid ? (
        <span id="gate-code-error" role="alert" className="text-sm text-danger">
          {t("invalid")}
        </span>
      ) : null}
      <Button
        type="submit"
        intent="primary"
        size="lg"
        fullWidth
        disabled={busy || !value.trim()}
        aria-busy={busy || undefined}
      >
        {t("submit")}
      </Button>
    </form>
  );
}
