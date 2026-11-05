"use client";

import { SegmentedControl, TopNavShell } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { MyDeskTab } from "./_components/MyDeskTab";
import { PreferencesTab } from "./_components/PreferencesTab";
import { ProfileTab } from "./_components/ProfileTab";

const TABS = ["profile", "desk", "preferences"] as const;
type Tab = (typeof TABS)[number];

function Settings() {
  const t = useTranslations("settings");
  const [tab, setTab] = React.useState<Tab>("profile");

  return (
    <TopNavShell nav={<AppTopNav centerLabel={t("title")} />}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <h1 className="text-3xl font-semibold text-fg">{t("title")}</h1>

        <SegmentedControl
          className="max-w-full"
          aria-label={t("title")}
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          options={TABS.map((value) => ({
            value,
            label: (
              <>
                <span className="sm:hidden">{t(`tabs.${value}Short`)}</span>
                <span className="hidden sm:inline">{t(`tabs.${value}`)}</span>
              </>
            ),
          }))}
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
