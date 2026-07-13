"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@vms/ui";
import { useLocale, useTranslations } from "next-intl";
import { useUpdateMe } from "@/data/settings/queries";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { SettingsDivider, SettingsRow } from "./SettingsRow";

const LOCALES = [
  { value: "en", labelKey: "en" },
  { value: "fr", labelKey: "fr" },
  { value: "ar", labelKey: "ar" },
] as const;

const TIMEZONES = [
  "( GMT +01:00 ) Nigeria",
  "( GMT +00:00 ) UTC",
  "( GMT +02:00 ) Cairo",
  "( GMT +04:00 ) Dubai",
];

const NOTIFICATIONS = [
  "newInviteRequest",
  "smDenied",
  "smApproved",
  "flaggedVisitor",
] as const;

export function PreferencesTab() {
  const t = useTranslations("settings");
  const tLang = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const updateMe = useUpdateMe();

  const prefs = user?.notificationPrefs;

  function setLanguage(next: string) {
    updateMe.mutate({
      preferredLocale: next.toUpperCase() as "EN" | "FR" | "AR",
    });
    router.replace(pathname, { locale: next });
  }

  return (
    <div className="flex flex-col">
      <SettingsRow title={t("language.title")} description={t("language.help")}>
        <Select value={locale} onValueChange={setLanguage}>
          <SelectTrigger className="max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALES.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {tLang(l.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      <SettingsDivider />

      <SettingsRow title={t("region.title")} description={t("region.help")}>
        <Select
          value={user?.timezone ?? TIMEZONES[0]}
          onValueChange={(value) => updateMe.mutate({ timezone: value })}
        >
          <SelectTrigger className="max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      <SettingsDivider />

      <SettingsRow
        title={t("notifications.title")}
        description={t("notifications.help")}
      >
        <ul className="flex flex-col">
          {NOTIFICATIONS.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between border-b border-border py-3 last:border-0"
            >
              <span className="text-sm text-fg">
                {t(`notifications.${key}`)}
              </span>
              <Switch
                checked={prefs ? prefs[key] : true}
                onCheckedChange={(checked) =>
                  updateMe.mutate({ notificationPrefs: { [key]: checked } })
                }
                aria-label={t(`notifications.${key}`)}
              />
            </li>
          ))}
        </ul>
      </SettingsRow>
    </div>
  );
}
