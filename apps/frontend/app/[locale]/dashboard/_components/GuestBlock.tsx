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
} from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
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
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label} {required ? <span className="text-danger">*</span> : null}
      </Label>
      {children}
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
  /** Toggle "Use same visit details" for this guest (handled by the parent). */
  onUseSameChange: (v: boolean) => void;
  showErrors: boolean;
  fixedHostName?: string;
  onChange: (patch: Partial<GuestEntry>) => void;
  /** Group visit: shared group name/contact fields show and "use same" is forced. */
  isGroupVisit?: boolean;
  groupName?: string;
  groupContact?: string;
  onGroupNameChange?: (v: string) => void;
  onGroupContactChange?: (v: string) => void;
}

/** One guest's Guest Details + Visit Details. */
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
}: GuestBlockProps) {
  const t = useTranslations("invite");
  const id = (f: string) => `guest-${index}-${f}`;
  const detailErr = showErrors && !guestDetailsValid(value);

  return (
    <div className="flex flex-col gap-6">
      {/* Guest Details */}
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

      {/* Visit Details */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <SectionHeader>{t("sections.visitDetails")}</SectionHeader>
          {/*
           * Group visit forces shared details — checked & disabled on every guest.
           * Otherwise the toggle only appears from the second guest onward (the
           * first has no previous guest to copy from).
           */}
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
            <Field label={t("fields.groupName")} required htmlFor={id("groupName")}>
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

        {mode === "invite" ? (
          <Field label={t("fields.host")} required>
            {fixedHostName ? (
              <div className="flex h-10 items-center rounded-md border border-border bg-surface-muted px-3 text-sm text-fg">
                {fixedHostName}
              </div>
            ) : (
              <Select
                value={value.hostUserId}
                onValueChange={(hostUserId) => onChange({ hostUserId })}
              >
                <SelectTrigger
                  className={
                    "w-full" +
                    (showErrors && !value.hostUserId ? " border-danger" : "")
                  }
                >
                  <SelectValue placeholder={t("fields.hostPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {hosts.map((h) => (
                    <SelectItem key={h.userId} value={h.userId}>
                      {h.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        ) : null}

        <Field label={t("fields.floor")} required>
          <Select
            value={value.floor}
            onValueChange={(floor) => onChange({ floor })}
          >
            <SelectTrigger
              className={
                "w-full" + (showErrors && !value.floor ? " border-danger" : "")
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
    </div>
  );
}
