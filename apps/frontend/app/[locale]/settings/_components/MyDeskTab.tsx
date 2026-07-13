"use client";

import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@vms/ui";
import { FLOORS } from "@vms/contracts";
import { Monitor } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSessions, useUpdateMe } from "@/data/settings/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { SettingsDivider, SettingsRow } from "./SettingsRow";

export function MyDeskTab() {
  const t = useTranslations("settings");
  const format = useFormatter();
  const { user } = useAuth();
  const updateMe = useUpdateMe();
  const { data: sessions, isLoading } = useSessions();

  // The office floor drives the staff dashboard's "Office Floor" panel; offer the
  // canonical FLOORS list so the two stay in sync.
  const desk = user?.assignedDesk ?? FLOORS[0];

  return (
    <div className="flex flex-col">
      <SettingsRow title={t("desk.title")} description={t("desk.help")}>
        <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-4">
          <span className="flex size-10 items-center justify-center rounded-lg bg-surface text-primary">
            <Monitor className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="font-semibold text-fg">{t("desk.mainLobby")}</span>
            <span className="text-sm text-fg-muted">
              AATC, Abuja CBD, Nigeria
            </span>
          </div>
        </div>
        <Select
          value={desk}
          onValueChange={(value) => updateMe.mutate({ assignedDesk: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FLOORS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      <SettingsDivider />

      <SettingsRow title={t("activity.title")} description={t("activity.help")}>
        {isLoading ? (
          <Spinner />
        ) : (
          <ul className="flex flex-col gap-6">
            {(sessions ?? []).map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Monitor
                    className="mt-0.5 size-5 text-fg-muted"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-fg">
                      {s.os} · {s.browser}
                    </span>
                    <Badge
                      intent={s.current ? "success" : "warning"}
                      tone="soft"
                    >
                      {s.current
                        ? t("activity.current")
                        : t("activity.previous")}
                    </Badge>
                    <span className="text-sm text-fg-muted">
                      {s.location ? `${s.location} · ` : ""}
                      {format.dateTime(new Date(s.lastSeenAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>
                <span className="whitespace-nowrap text-sm text-fg-muted">
                  {t("activity.notYou")}{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                  >
                    {t("activity.reportIssue")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsRow>
    </div>
  );
}
