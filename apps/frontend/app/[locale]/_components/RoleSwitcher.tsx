"use client";

import { homeFor, switchableRoles } from "@vms/contracts";
import { cn, Popover, PopoverContent, PopoverTrigger } from "@vms/ui";
import { Check, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { roleLabel } from "@/shared/auth/roleLabels";

/** Roles the user can switch between (add-ons only extend a role, so never listed), and the switch itself. */
export function useRoleSwitch() {
  const { user, activeRole, switchRole } = useAuth();
  const router = useRouter();
  const roles = switchableRoles(user?.roles ?? []);

  async function select(role: string) {
    if (role === activeRole) return;
    const profile = await switchRole(role);
    router.replace(homeFor(profile.activeRole));
  }

  return { roles, activeRole, select, canSwitch: roles.length >= 2 };
}

/** The selectable role list, shared by the navbar popover and the mobile account menu. */
export function RoleOptions({
  id,
  className,
}: {
  id?: string;
  className?: string;
}) {
  const tRoles = useTranslations("roles");
  const { roles, activeRole, select } = useRoleSwitch();
  return (
    <ul id={id} className={cn("flex flex-col", className)}>
      {roles.map((role) => {
        const active = role === activeRole;
        return (
          <li key={role}>
            <button
              type="button"
              aria-current={active || undefined}
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
  );
}

/** Navbar pill from md up; on small screens switching lives in the account menu. */
export function RoleSwitcher() {
  const t = useTranslations("nav");
  const { canSwitch } = useRoleSwitch();
  if (!canSwitch) return null;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "hidden items-center gap-2 rounded-full border border-emphasis-border px-4 py-1.5 text-sm font-medium text-emphasis-fg transition-colors outline-none md:inline-flex",
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
        <RoleOptions />
      </PopoverContent>
    </Popover>
  );
}
