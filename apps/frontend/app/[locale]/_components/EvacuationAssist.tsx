"use client";

import {
  EVACUATION_ASSIST_OTHER_MAX,
  EVACUATION_ASSIST_TYPES,
  type EvacuationAssistType,
} from "@vms/contracts";
import { Checkbox, Input, cn } from "@vms/ui";
import { useTranslations } from "next-intl";

export interface EvacuationAssistValue {
  evacuationAssistTypes: EvacuationAssistType[];
  evacuationAssistOther: string;
}

/** Shown once the evacuation answer is Yes: at least one type is required, and OTHER needs a description. */
export function EvacuationAssistFields({
  id,
  value,
  onChange,
  showErrors,
  className,
}: {
  id: string;
  value: EvacuationAssistValue;
  onChange: (patch: Partial<EvacuationAssistValue>) => void;
  showErrors: boolean;
  className?: string;
}) {
  const t = useTranslations("evacuationAssist");
  const types = value.evacuationAssistTypes;
  const hasOther = types.includes("OTHER");
  const noType = showErrors && types.length === 0;
  const noOther = showErrors && hasOther && !value.evacuationAssistOther.trim();

  const toggle = (type: EvacuationAssistType, on: boolean) => {
    const next = on
      ? [...types, type]
      : types.filter((existing) => existing !== type);
    // Keep the building order, whatever order they were ticked in.
    onChange({
      evacuationAssistTypes: EVACUATION_ASSIST_TYPES.filter((x) =>
        next.includes(x),
      ),
      ...(type === "OTHER" && !on ? { evacuationAssistOther: "" } : {}),
    });
  };

  return (
    <fieldset
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border bg-surface-muted p-3",
        noType ? "border-danger" : "border-transparent",
        className,
      )}
      aria-describedby={noType ? `${id}-error` : undefined}
    >
      <legend className="sr-only">{t("question")}</legend>
      <span aria-hidden="true" className="text-sm font-medium text-fg">
        {t("question")} <span className="text-danger">*</span>
      </span>
      {EVACUATION_ASSIST_TYPES.map((type) => (
        <label
          key={type}
          htmlFor={`${id}-${type}`}
          className="flex cursor-pointer items-start gap-2.5 text-sm text-fg"
        >
          <Checkbox
            id={`${id}-${type}`}
            checked={types.includes(type)}
            onCheckedChange={(c) => toggle(type, c === true)}
            className="mt-0.5"
          />
          {t(`types.${type}`)}
        </label>
      ))}
      {hasOther ? (
        <div className="flex flex-col gap-1.5 ps-7">
          <Input
            id={`${id}-other`}
            value={value.evacuationAssistOther}
            maxLength={EVACUATION_ASSIST_OTHER_MAX}
            placeholder={t("otherPlaceholder")}
            aria-label={t("otherLabel")}
            invalid={noOther}
            aria-describedby={noOther ? `${id}-other-error` : undefined}
            onChange={(e) =>
              onChange({ evacuationAssistOther: e.target.value })
            }
          />
          {noOther ? (
            <span id={`${id}-other-error`} className="text-sm text-danger">
              {t("describeOther")}
            </span>
          ) : null}
        </div>
      ) : null}
      {noType ? (
        <span id={`${id}-error`} className="text-sm text-danger">
          {t("chooseType")}
        </span>
      ) : null}
    </fieldset>
  );
}

/** "Mobility, Other: needs a ramp" for read-only views. */
export function useEvacuationAssistText() {
  const t = useTranslations("evacuationAssist");
  return (types: readonly EvacuationAssistType[], other?: string | null) =>
    types
      .map((type) =>
        type === "OTHER" && other
          ? `${t("short.OTHER")}: ${other}`
          : t(`short.${type}`),
      )
      .join(", ");
}
