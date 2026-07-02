"use client";

import { Input } from "@vms/ui";
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
}

/**
 * Telephone field with a dialling-code selector glued to the number input. The
 * two values are stored separately and assembled into one E.164 string at submit
 * time via `toE164` (@vms/contracts). The number box accepts digits only, so a
 * dial code / `+` / spaces can't be typed into it — the historical source of
 * malformed, doubled-country-code numbers.
 */
export function PhoneInput({
  code,
  number,
  onCodeChange,
  onNumberChange,
  placeholder,
  invalid,
  id,
}: PhoneInputProps) {
  return (
    <div
      className={
        "flex h-10 items-stretch overflow-hidden rounded-md border " +
        (invalid ? "border-danger" : "border-border")
      }
    >
      <div className="flex items-center gap-1 border-e border-border bg-surface-muted ps-2 pe-1">
        <span aria-hidden="true">🇳🇬</span>
        <select
          aria-label="Country dialling code"
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
        type="tel"
        inputMode="tel"
        value={number}
        placeholder={placeholder}
        // Digits only — the country code comes from the selector, never the box.
        onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
        className="flex-1 border-0 focus-visible:ring-0"
      />
    </div>
  );
}
