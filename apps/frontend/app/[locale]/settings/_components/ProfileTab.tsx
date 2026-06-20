"use client";

import { Button, Input, Label } from "@vms/ui";
import { Monitor, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useUpdateMe } from "@/data/settings/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { roleLabel } from "@/shared/auth/roleLabels";
import { AvatarUpload } from "./AvatarUpload";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { SettingsDivider, SettingsRow } from "./SettingsRow";

function ReadonlyField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Monitor;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 text-sm text-fg-muted">
        {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
        {value || "—"}
      </div>
    </div>
  );
}

export function ProfileTab() {
  const t = useTranslations("settings");
  const tRoles = useTranslations("roles");
  const { user, activeRole } = useAuth();
  const updateMe = useUpdateMe();

  const [firstName, setFirstName] = React.useState(user?.firstName ?? "");
  const [lastName, setLastName] = React.useState(user?.lastName ?? "");
  const [phone, setPhone] = React.useState(
    user?.phone?.replace(/^\+234\s*/, "") ?? "",
  );

  function save() {
    updateMe.mutate({
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      phone: phone.trim() ? `+234 ${phone.trim()}` : null,
    });
  }

  return (
    <div className="flex flex-col">
      <SettingsRow
        title={t("profile.personalInfo")}
        description={t("profile.personalInfoHelp")}
      >
        <AvatarUpload />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">{t("profile.firstName")}</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">{t("profile.lastName")}</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <ReadonlyField label={t("profile.email")} value={user?.email ?? ""} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">{t("profile.phone")}</Label>
            <div className="flex gap-2">
              <span className="inline-flex h-10 items-center rounded-md border border-border bg-surface-muted px-3 text-sm text-fg-muted">
                +234
              </span>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="000-000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <ReadonlyField
            label={t("profile.role")}
            value={roleLabel(tRoles, activeRole)}
            icon={UserRound}
          />
          <ReadonlyField
            label={t("profile.station")}
            value={user?.assignedDesk ?? ""}
            icon={Monitor}
          />
        </div>
        <div>
          <Button onClick={save} disabled={updateMe.isPending}>
            {t("profile.save")}
          </Button>
        </div>
      </SettingsRow>

      <SettingsDivider />

      <SettingsRow title={t("password.title")} description={t("password.help")}>
        <div className="flex flex-col gap-1.5">
          <Label>{t("password.current")}</Label>
          <div className="flex h-10 items-center rounded-md border border-border bg-surface-muted px-3 text-sm tracking-widest text-fg-muted">
            ••••••••••••••••
          </div>
        </div>
        <div>
          <ChangePasswordDialog />
        </div>
      </SettingsRow>
    </div>
  );
}
