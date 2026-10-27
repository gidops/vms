"use client";

import { Label, YesNoControl } from "@vms/ui";
import { useTranslations } from "next-intl";
import type * as React from "react";

const errorId = (id: string) => `${id}-error`;

/** Spread on the control so screen readers read the error with the field. */
export function errorProps(id: string, error: string | undefined) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId(id) : undefined,
  } as const;
}

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <span id={errorId(id)} className="text-sm text-danger">
      {error}
    </span>
  ) : null;
}

export function Field({
  id,
  label,
  required,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("selfRegister");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
        {optional ? (
          <span className="ms-1.5 font-normal text-fg-subtle">
            {t("optional")}
          </span>
        ) : null}
      </Label>
      {children}
      <FieldError id={id} error={error} />
    </div>
  );
}

export function YesNo({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  error?: string;
}) {
  const t = useTranslations("selfRegister");
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-medium text-fg">
        {label} <span className="text-danger">*</span>
      </span>
      <YesNoControl
        id={id}
        value={value}
        onValueChange={onChange}
        yesLabel={t("yes")}
        noLabel={t("no")}
        invalid={Boolean(error)}
        aria-labelledby={`${id}-label`}
        aria-describedby={errorProps(id, error)["aria-describedby"]}
        fullWidth
      />
      <FieldError id={id} error={error} />
    </div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold tracking-wide text-primary uppercase">
      {children}
    </h3>
  );
}
