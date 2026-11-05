"use client";

import { FLOORS, VISIT_PURPOSES } from "@vms/contracts";
import {
  Alert,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { EvacuationAssistFields } from "@/app/[locale]/_components/EvacuationAssist";
import { PhoneInput } from "@/app/[locale]/_components/PhoneInput";
import type { SelfForm, SelfFormField } from "../self-registration";
import { Field, SectionHeading, YesNo, errorProps } from "./Field";
import { HostPicker } from "./HostPicker";

const NO_FLOOR = "__none";

export function FormStep({
  token,
  formToken,
  form,
  patch,
  errorOf,
  showErrors,
  banner,
  busy,
  onSubmit,
}: {
  token: string;
  formToken: string;
  form: SelfForm;
  patch: (p: Partial<SelfForm>) => void;
  /** The message to show under a field, once errors are on. */
  errorOf: (field: SelfFormField) => string | undefined;
  showErrors: boolean;
  banner: string | null;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const t = useTranslations("selfRegister");
  const tf = useTranslations("invite.fields");
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-5 px-5 py-6">
        {banner ? (
          <Alert intent="danger">
            <span>{banner}</span>
          </Alert>
        ) : null}

        {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
        <div
          aria-hidden="true"
          className="absolute -start-[9999px] size-px overflow-hidden"
        >
          <label htmlFor="sr-website">Website</label>
          <input
            id="sr-website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => patch({ website: e.target.value })}
          />
        </div>

        <SectionHeading>{t("sections.contact")}</SectionHeading>
        <Field
          id="sr-email"
          label={t("fields.email")}
          required
          error={errorOf("email")}
        >
          <Input
            id="sr-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => patch({ email: e.target.value })}
            placeholder="name@company.com"
            {...errorProps("sr-email", errorOf("email"))}
          />
        </Field>
        <Field
          id="sr-phone"
          label={t("fields.phone")}
          optional
          error={errorOf("phone")}
        >
          <PhoneInput
            id="sr-phone"
            code={form.phoneCode}
            number={form.phoneNumber}
            onCodeChange={(phoneCode) => patch({ phoneCode })}
            onNumberChange={(phoneNumber) => patch({ phoneNumber })}
            placeholder="801 234 5678"
            invalid={Boolean(errorOf("phone"))}
            describedBy={
              errorProps("sr-phone", errorOf("phone"))["aria-describedby"]
            }
          />
        </Field>

        <SectionHeading>{t("sections.about")}</SectionHeading>
        <Field
          id="sr-name"
          label={t("fields.fullName")}
          required
          error={errorOf("fullName")}
        >
          <Input
            id="sr-name"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => patch({ fullName: e.target.value })}
            {...errorProps("sr-name", errorOf("fullName"))}
          />
        </Field>
        <Field
          id="sr-org"
          label={t("fields.organization")}
          required
          error={errorOf("organization")}
        >
          <Input
            id="sr-org"
            autoComplete="organization"
            value={form.organization}
            onChange={(e) => patch({ organization: e.target.value })}
            {...errorProps("sr-org", errorOf("organization"))}
          />
        </Field>

        <SectionHeading>{t("sections.visiting")}</SectionHeading>
        <HostPicker
          token={token}
          formToken={formToken}
          value={form.host}
          onChange={(host) => patch({ host })}
        />

        <SectionHeading>{t("sections.visit")}</SectionHeading>
        <Field id="sr-floor" label={t("fields.floor")} optional>
          <Select
            value={form.floor || NO_FLOOR}
            onValueChange={(v) => patch({ floor: v === NO_FLOOR ? "" : v })}
          >
            <SelectTrigger id="sr-floor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FLOOR}>
                {t("fields.floorNotSure")}
              </SelectItem>
              {FLOORS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          id="sr-purpose"
          label={t("fields.purpose")}
          required
          error={errorOf("purpose")}
        >
          <Select
            value={form.purpose}
            onValueChange={(purpose) => patch({ purpose })}
          >
            <SelectTrigger
              id="sr-purpose"
              {...errorProps("sr-purpose", errorOf("purpose"))}
            >
              <SelectValue placeholder={tf("purposePlaceholder")} />
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

        <SectionHeading>{t("sections.safety")}</SectionHeading>
        <YesNo
          id="sr-evacuation"
          label={t("fields.evacuation")}
          value={form.needsEvacuationAssist}
          onChange={(v) =>
            patch(
              v
                ? { needsEvacuationAssist: v }
                : {
                    needsEvacuationAssist: v,
                    evacuationAssistTypes: [],
                    evacuationAssistOther: "",
                  },
            )
          }
          error={errorOf("needsEvacuationAssist")}
        />
        {form.needsEvacuationAssist ? (
          <EvacuationAssistFields
            id="sr-evacuation-types"
            value={{
              evacuationAssistTypes: form.evacuationAssistTypes,
              evacuationAssistOther: form.evacuationAssistOther,
            }}
            onChange={patch}
            showErrors={showErrors}
          />
        ) : null}
        <YesNo
          id="sr-consent"
          label={t("fields.consent")}
          value={form.commsConsent}
          onChange={(v) => patch({ commsConsent: v })}
          error={errorOf("commsConsent")}
        />
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="submit"
          intent="primary"
          size="lg"
          fullWidth
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {t("submit")}
        </Button>
        <p className="text-center text-xs text-fg-muted">{t("submitHelp")}</p>
      </div>
    </form>
  );
}
