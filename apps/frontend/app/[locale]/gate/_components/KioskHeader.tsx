"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/app/[locale]/_components/LanguageSwitcher";

/** The kiosk's only chrome: brand, title and the language switcher. No account, no navigation. */
export function KioskHeader() {
  const t = useTranslations("gate");
  return (
    <header className="flex items-center gap-2.5 bg-emphasis px-4 py-3 text-emphasis-fg sm:px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/afreximbank.svg" alt="" className="size-8" />
      <span className="font-semibold">{t("title")}</span>
      <span className="ms-auto">
        <LanguageSwitcher />
      </span>
    </header>
  );
}
