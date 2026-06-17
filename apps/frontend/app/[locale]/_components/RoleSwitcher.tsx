"use client";

import { homeFor } from "@vms/contracts";
import { cn, Popover, PopoverContent, PopoverTrigger } from "@vms/ui";
import { Check, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { roleLabel } from "@/shared/auth/roleLabels";

/** "Switch Account" pill → list of the user's roles. Hidden for single-role users. */
export function RoleSwitcher() {
  const t = useTranslations("nav");
  const tRoles = useTranslations("roles");
  const { user, activeRole, switchRole } = useAuth();
  const router = useRouter();

  const roles = user?.roles ?? [];
  if (roles.length < 2) return null;

  async function select(role: string) {
    if (role === activeRole) return;
    const profile = await switchRole(role);
    router.replace(homeFor(profile.activeRole));
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-emphasis-border px-4 py-1.5 text-sm font-medium text-emphasis-fg transition-colors outline-none",
          "hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          "data-[state=open]:bg-white/10",
        )}
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {t("switchAccount")}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {t("switchAccount")}
        </p>
        <ul className="flex flex-col">
          {roles.map((role) => {
            const active = role === activeRole;
            return (
              <li key={role}>
                <button
                  type="button"
                  onClick={() => void select(role)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-sm text-fg transition-colors hover:bg-surface-muted"
                >
                  <span className={active ? "font-medium text-primary" : ""}>
                    {roleLabel(tRoles, role)}
                  </span>
                  {active ? (
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
