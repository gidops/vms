"use client";

import { cn, Popover, PopoverContent, PopoverTrigger } from "@vms/ui";
import { Check, Globe, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

const LOCALES = ["en", "fr", "ar"] as const;

/** Language list for the mobile account menu, styled like the role options beside it. */
export function LanguageOptions({
  id,
  className,
}: {
  id?: string;
  className?: string;
}) {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <ul id={id} className={cn("flex flex-col", className)}>
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <li key={l}>
            <button
              type="button"
              aria-current={active || undefined}
              onClick={() => router.replace(pathname, { locale: l })}
              className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-sm text-fg transition-colors hover:bg-surface-muted"
            >
              <span className={active ? "font-medium text-primary" : ""}>
                {t(l)}
              </span>
              {active ? (
                <Check className="size-4 text-primary" aria-hidden="true" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Globe button → language radio list, from md up. Switching re-routes, preserving path. */
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
          "hidden size-9 items-center justify-center rounded-full bg-white/10 text-accent transition-colors outline-none md:inline-flex",
          // Hover (and open) flips it: yellow disc, globe in the navbar green.
          "hover:bg-accent hover:text-emphasis focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          "data-[state=open]:bg-accent data-[state=open]:text-emphasis",
        )}
      >
        <Globe className="size-5" strokeWidth={1.5} aria-hidden="true" />
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
