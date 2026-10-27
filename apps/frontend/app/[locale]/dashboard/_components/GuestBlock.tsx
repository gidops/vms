"use client";

import type { HostOption } from "@vms/contracts";
import { FLOORS, VISIT_PURPOSES } from "@vms/contracts";
import {
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  SegmentedControl,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { EvacuationAssistFields } from "../../_components/EvacuationAssist";
import { PhoneInput } from "../../_components/PhoneInput";
import {
  guestDetailsValid,
  phoneValid,
  scheduledAtOf,
  type GuestEntry,
  type VisitFormMode,
} from "./guest-form";

function Field({
  label,
  required,
  optionalLabel,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  optionalLabel?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label} {required ? <span className="text-danger">*</span> : null}
        {optionalLabel ? (
          <span className="ms-1 font-normal text-fg-subtle">
            {optionalLabel}
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}

/** Sentinel for the walk-in "No host" option (Radix Select disallows ""). */
const NO_HOST = "__none__";

/** Full-width control under the question, since the form lives in a narrow drawer. */
function YesNoQuestion({
  id,
  label,
  value,
  onChange,
  showErrors,
  yesLabel,
  noLabel,
  errorLabel,
}: {
  id: string;
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  showErrors: boolean;
  yesLabel: string;
  noLabel: string;
  errorLabel: string;
}) {
  const invalid = showErrors && value === null;
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-medium text-fg">
        {label} <span className="text-danger">*</span>
      </span>
      <div className="flex flex-col gap-1.5">
        <SegmentedControl
          id={id}
          options={[
            { value: "yes", label: yesLabel },
            { value: "no", label: noLabel },
          ]}
          value={value === null ? null : value ? "yes" : "no"}
          onValueChange={(v) => onChange(v === "yes")}
          tone="primary"
          required
          invalid={invalid}
          aria-labelledby={`${id}-label`}
          aria-describedby={invalid ? `${id}-error` : undefined}
          fullWidth
        />
        {invalid ? (
          <span id={`${id}-error`} className="text-sm text-danger">
            {errorLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-primary">{children}</h3>;
}

export interface GuestBlockProps {
  value: GuestEntry;
  index: number;
  mode: VisitFormMode;
  hosts: HostOption[];
  onUseSameChange: (v: boolean) => void;
  showErrors: boolean;
  fixedHostName?: string;
  onChange: (patch: Partial<GuestEntry>) => void;
  isGroupVisit?: boolean;
  groupName?: string;
  groupContact?: string;
  onGroupNameChange?: (v: string) => void;
  onGroupContactChange?: (v: string) => void;
  /** Editing shows only the evacuation question; comms consent changes via the opt-ins register. */
  safety?: "full" | "evacuationOnly";
}

export function GuestBlock({
  value,
  index,
  mode,
  hosts,
  onUseSameChange,
  showErrors,
  fixedHostName,
  onChange,
  isGroupVisit = false,
  groupName = "",
  groupContact = "",
  onGroupNameChange,
  onGroupContactChange,
  safety = "full",
}: GuestBlockProps) {
  const t = useTranslations("invite");
  const id = (f: string) => `guest-${index}-${f}`;
  const detailErr = showErrors && !guestDetailsValid(value);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <SectionHeader>{t("sections.guestDetails")}</SectionHeader>
        <Field label={t("fields.fullName")} required htmlFor={id("name")}>
          <Input
            id={id("name")}
            value={value.fullName}
            invalid={detailErr && !value.fullName.trim()}
            placeholder={t("fields.fullNamePlaceholder")}
            onChange={(e) => onChange({ fullName: e.target.value })}
          />
        </Field>
        <div className="flex flex-col gap-4">
          <Field label={t("fields.email")} required htmlFor={id("email")}>
            <Input
              id={id("email")}
              type="email"
              value={value.email}
              invalid={detailErr && !value.email.trim()}
              placeholder={t("fields.emailPlaceholder")}
              onChange={(e) => onChange({ email: e.target.value })}
            />
          </Field>
          <Field label={t("fields.organization")} required htmlFor={id("org")}>
            <Input
              id={id("org")}
              value={value.organization}
              invalid={detailErr && !value.organization.trim()}
              placeholder={t("fields.organizationPlaceholder")}
              onChange={(e) => onChange({ organization: e.target.value })}
            />
          </Field>
        </div>
        <Field label={t("fields.phone")} required htmlFor={id("phone")}>
          <PhoneInput
            id={id("phone")}
            code={value.phoneCode}
            number={value.phoneNumber}
            invalid={detailErr && !phoneValid(value)}
            placeholder={t("fields.phonePlaceholder")}
            onCodeChange={(phoneCode) => onChange({ phoneCode })}
            onNumberChange={(phoneNumber) => onChange({ phoneNumber })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <SectionHeader>{t("sections.visitDetails")}</SectionHeader>
          {/* The first guest has nothing to copy from, so the toggle starts at the second. */}
          {isGroupVisit ? (
            <label className="inline-flex items-center gap-2 text-sm font-medium text-primary underline">
              <Checkbox checked disabled />
              {t("useSameVisitDetails")}
            </label>
          ) : index > 0 ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-primary underline">
              <Checkbox
                checked={value.useSame}
                onCheckedChange={(c) => onUseSameChange(c === true)}
              />
              {t("useSameVisitDetails")}
            </label>
          ) : null}
        </div>

        {isGroupVisit ? (
          <>
            <Field
              label={t("fields.groupName")}
              required
              htmlFor={id("groupName")}
            >
              <Input
                id={id("groupName")}
                value={groupName}
                invalid={showErrors && !groupName.trim()}
                placeholder={t("fields.groupNamePlaceholder")}
                onChange={(e) => onGroupNameChange?.(e.target.value)}
              />
            </Field>
            <Field
              label={t("fields.groupContact")}
              htmlFor={id("groupContact")}
            >
              <Input
                id={id("groupContact")}
                type="text"
                value={groupContact}
                placeholder={t("fields.groupContactPlaceholder")}
                onChange={(e) => onGroupContactChange?.(e.target.value)}
              />
            </Field>
          </>
        ) : null}

        {/* Hidden for a staff self-invite: the host is pinned to the signed-in user. */}
        {!fixedHostName ? (
          <Field
            label={t("fields.host")}
            required={mode === "invite"}
            optionalLabel={mode === "walkin" ? t("fields.optional") : undefined}
          >
            <Select
              value={value.hostUserId}
              onValueChange={(v) =>
                onChange({ hostUserId: v === NO_HOST ? "" : v })
              }
            >
              <SelectTrigger
                aria-label={t("fields.host")}
                className={
                  "w-full" +
                  (mode === "invite" && showErrors && !value.hostUserId
                    ? " border-danger"
                    : "")
                }
              >
                <SelectValue placeholder={t("fields.hostPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {mode === "walkin" && value.hostUserId ? (
                  <SelectItem value={NO_HOST}>{t("fields.noHost")}</SelectItem>
                ) : null}
                {hosts.map((h) => (
                  <SelectItem key={h.userId} value={h.userId}>
                    {h.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <div className="flex flex-col gap-4">
          <Field label={t("fields.floor")} required>
            <Select
              value={value.floor}
              onValueChange={(floor) => onChange({ floor })}
            >
              <SelectTrigger
                className={
                  "w-full" +
                  (showErrors && !value.floor ? " border-danger" : "")
                }
              >
                <SelectValue placeholder={t("fields.floorPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {FLOORS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("fields.purpose")} required>
            <Select
              value={value.purpose}
              onValueChange={(purpose) => onChange({ purpose })}
            >
              <SelectTrigger
                className={
                  "w-full" +
                  (showErrors && !value.purpose ? " border-danger" : "")
                }
              >
                <SelectValue placeholder={t("fields.purposePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {VISIT_PURPOSES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {mode === "invite" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fields.visitDate")} required htmlFor={id("date")}>
              <Input
                id={id("date")}
                type="date"
                value={value.scheduledDate}
                invalid={showErrors && !value.scheduledDate}
                onChange={(e) => onChange({ scheduledDate: e.target.value })}
              />
            </Field>
            <Field label={t("fields.visitTime")} required htmlFor={id("time")}>
              <Input
                id={id("time")}
                type="time"
                value={value.scheduledTime}
                invalid={
                  showErrors && (!value.scheduledTime || !scheduledAtOf(value))
                }
                onChange={(e) => onChange({ scheduledTime: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        <Field label={t("fields.notes")} htmlFor={id("notes")}>
          <Textarea
            id={id("notes")}
            value={value.notes}
            placeholder={t("fields.notesPlaceholder")}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeader>{t("sections.safetyConsent")}</SectionHeader>
        <div className="flex flex-col gap-4">
          <YesNoQuestion
            id={id("evacuation")}
            label={t("fields.evacuationAssist")}
            value={value.needsEvacuationAssist}
            onChange={(needsEvacuationAssist) =>
              onChange(
                needsEvacuationAssist
                  ? { needsEvacuationAssist }
                  : {
                      needsEvacuationAssist,
                      evacuationAssistTypes: [],
                      evacuationAssistOther: "",
                    },
              )
            }
            showErrors={showErrors}
            yesLabel={t("fields.yes")}
            noLabel={t("fields.no")}
            errorLabel={t("fields.chooseYesNo")}
          />
          {value.needsEvacuationAssist ? (
            <EvacuationAssistFields
              id={id("evacuationTypes")}
              value={{
                evacuationAssistTypes: value.evacuationAssistTypes,
                evacuationAssistOther: value.evacuationAssistOther,
              }}
              onChange={onChange}
              showErrors={showErrors}
            />
          ) : null}
          {safety === "full" ? (
            <YesNoQuestion
              id={id("consent")}
              label={t("fields.commsConsent")}
              value={value.commsConsent}
              onChange={(commsConsent) => onChange({ commsConsent })}
              showErrors={showErrors}
              yesLabel={t("fields.yes")}
              noLabel={t("fields.no")}
              errorLabel={t("fields.chooseYesNo")}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
