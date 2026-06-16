"use client";

import { SegmentedControl, TopNavShell } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { MyDeskTab } from "./_components/MyDeskTab";
import { PreferencesTab } from "./_components/PreferencesTab";
import { ProfileTab } from "./_components/ProfileTab";

type Tab = "profile" | "desk" | "preferences";

function Settings() {
  const t = useTranslations("settings");
  const [tab, setTab] = React.useState<Tab>("profile");

  return (
    <TopNavShell nav={<AppTopNav centerLabel={t("title")} />}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <h1 className="text-3xl font-semibold text-fg">{t("title")}</h1>

        <SegmentedControl
          aria-label={t("title")}
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          options={[
            { value: "profile", label: t("tabs.profile") },
            { value: "desk", label: t("tabs.desk") },
            { value: "preferences", label: t("tabs.preferences") },
          ]}
        />

        {tab === "profile" ? <ProfileTab /> : null}
        {tab === "desk" ? <MyDeskTab /> : null}
        {tab === "preferences" ? <PreferencesTab /> : null}
      </div>
    </TopNavShell>
  );
}

export default function SettingsPage() {
  return (
    <RouteGuard>
      <Settings />
    </RouteGuard>
  );
}
