"use client";

import { Input, Label } from "@vms/ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export interface VisitorEntry {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  phone: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Per-visitor field validity (used to gate the step + show inline errors). */
export function visitorErrors(v: VisitorEntry): {
  fullName: boolean;
  email: boolean;
  organization: boolean;
} {
  return {
    fullName: v.fullName.trim().length === 0,
    email: !EMAIL_RE.test(v.email.trim()),
    organization: v.organization.trim().length === 0,
  };
}

export interface VisitorFieldsProps {
  value: VisitorEntry;
  index: number;
  canRemove: boolean;
  showErrors: boolean;
  onChange: (patch: Partial<VisitorEntry>) => void;
  onRemove: () => void;
}

export function VisitorFields({
  value,
  index,
  canRemove,
  showErrors,
  onChange,
  onRemove,
}: VisitorFieldsProps) {
  const t = useTranslations("invite");
  const err = visitorErrors(value);
  const id = (f: string) => `visitor-${index}-${f}`;

  return (
    <div className="flex flex-col gap-4">
      {index > 0 ? (
        <div className="flex items-center justify-between">
          <span className="border-t border-dashed border-border flex-1" />
          {canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="ms-3 inline-flex items-center gap-1 text-xs text-danger hover:underline"
            >
              <X className="size-3.5" aria-hidden="true" />
              {t("removeVisitor")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("name")}>
            {t("fields.fullName")} <span className="text-danger">*</span>
          </Label>
          <Input
            id={id("name")}
            value={value.fullName}
            invalid={showErrors && err.fullName}
            placeholder={t("fields.fullNamePlaceholder")}
            onChange={(e) => onChange({ fullName: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("email")}>
            {t("fields.email")} <span className="text-danger">*</span>
          </Label>
          <Input
            id={id("email")}
            type="email"
            value={value.email}
            invalid={showErrors && err.email}
            placeholder={t("fields.emailPlaceholder")}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("org")}>
            {t("fields.organization")} <span className="text-danger">*</span>
          </Label>
          <Input
            id={id("org")}
            value={value.organization}
            invalid={showErrors && err.organization}
            placeholder={t("fields.organizationPlaceholder")}
            onChange={(e) => onChange({ organization: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("phone")}>{t("fields.phone")}</Label>
          <Input
            id={id("phone")}
            value={value.phone}
            placeholder={t("fields.phonePlaceholder")}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
