"use client";

import { Avatar, Popover, PopoverContent, PopoverTrigger } from "@vms/ui";
import { ChevronDown, HelpCircle, LogOut, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { roleLabel } from "@/shared/auth/roleLabels";
import { avatarUrl } from "@/shared/avatarUrl";

/** Avatar + chevron → account dropdown (identity, active role, settings, logout). */
export function AccountMenu() {
  const t = useTranslations("nav");
  const tRoles = useTranslations("roles");
  const { user, activeRole, logout } = useAuth();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.replace("/");
  }

  const avatar = avatarUrl(user?.avatarKey);

  return (
    <Popover>
      <PopoverTrigger
        aria-label={user?.fullName ?? "Account"}
        className="inline-flex items-center gap-1 rounded-full text-emphasis-fg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <Avatar name={user?.fullName ?? "User"} src={avatar} size="sm" />
        <ChevronDown className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="flex flex-col items-start gap-1 p-4">
          <Avatar name={user?.fullName ?? "User"} src={avatar} size="lg" />
          <span className="mt-1 font-semibold text-fg">{user?.fullName}</span>
          {activeRole ? (
            <span className="text-sm font-medium text-success">
              {roleLabel(tRoles, activeRole)}
            </span>
          ) : null}
        </div>
        <div className="border-t border-border p-2">
          <Link
            href="/settings"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-fg transition-colors hover:bg-surface-muted"
          >
            <Settings className="size-4 text-fg-muted" aria-hidden="true" />
            {t("accountSettings")}
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-fg transition-colors hover:bg-surface-muted"
          >
            <HelpCircle className="size-4 text-fg-muted" aria-hidden="true" />
            {t("help")}
          </button>
        </div>
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => void onLogout()}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-fg transition-colors hover:bg-surface-muted"
          >
            <LogOut className="size-4 text-fg-muted" aria-hidden="true" />
            {t("logout")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
