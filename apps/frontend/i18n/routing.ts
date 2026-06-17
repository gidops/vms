import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr", "ar"],
  defaultLocale: "en",
  // Default locale (en) is served without a prefix, so the login page lives at
  // "/"; other locales are prefixed (e.g. /fr, /ar).
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

const RTL_LOCALES: readonly string[] = ["ar"];

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale);
}
