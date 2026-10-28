"use client";

import { Input } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";

/** Dialling codes offered in the phone field; +234 (Nigeria) is the default. */
export const DIAL_CODES = ["+234", "+1", "+44", "+971", "+233", "+27"] as const;

export interface PhoneInputProps {
  code: string;
  number: string;
  onCodeChange: (code: string) => void;
  onNumberChange: (number: string) => void;
  placeholder?: string;
  invalid?: boolean;
  id?: string;
  /** Id of the element describing the number box, e.g. its error message. */
  describedBy?: string;
}

/** The number box accepts digits only, so a dial code can't be typed twice into the E.164 result. */
export function PhoneInput({
  code,
  number,
  onCodeChange,
  onNumberChange,
  placeholder,
  invalid,
  id,
  describedBy,
}: PhoneInputProps) {
  const t = useTranslations("common");
  return (
    // Phone numbers read left to right in every language (no "234+" in Arabic).
    <div
      dir="ltr"
      className={
        "flex h-10 items-stretch overflow-hidden rounded-md border transition-colors " +
        // The box, not the inner field, carries the focus border.
        (invalid
          ? "border-danger"
          : "border-border focus-within:border-[var(--color-ring)]")
      }
    >
      <div className="flex items-center gap-1 border-e border-border bg-surface-muted ps-2 pe-1">
        <span aria-hidden="true">🇳🇬</span>
        <select
          aria-label={t("countryDialCode")}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          className="bg-transparent py-2 pe-1 text-sm text-fg outline-none"
        >
          {DIAL_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <Input
        id={id}
        aria-describedby={describedBy}
        type="tel"
        inputMode="tel"
        value={number}
        placeholder={placeholder}
        // Digits only — the country code comes from the selector, never the box.
        onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
        className="flex-1 border-0"
      />
    </div>
  );
}
