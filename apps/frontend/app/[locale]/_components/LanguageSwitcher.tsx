"use client";

import { cn, Popover, PopoverContent, PopoverTrigger } from "@vms/ui";
import { Globe, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

const LOCALES = ["en", "fr", "ar"] as const;

/** Globe button → language radio list. Switching re-routes, preserving path. */
export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("select")}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-full border border-emphasis-border text-emphasis-fg transition-colors outline-none",
          "hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          "data-[state=open]:bg-accent data-[state=open]:text-accent-fg data-[state=open]:border-accent",
        )}
      >
        <Globe className="size-5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <p className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-fg">
          <Languages className="size-4" aria-hidden="true" />
          {t("select")}
        </p>
        <ul className="mt-1 flex flex-col">
          {LOCALES.map((l) => {
            const active = l === locale;
            return (
              <li key={l}>
                <button
                  type="button"
                  onClick={() => router.replace(pathname, { locale: l })}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-fg transition-colors hover:bg-surface-muted"
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border",
                      active ? "border-primary" : "border-border-strong",
                    )}
                  >
                    {active ? (
                      <span className="size-2 rounded-full bg-primary" />
                    ) : null}
                  </span>
                  <span className={active ? "font-medium text-primary" : ""}>
                    {t(l)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
