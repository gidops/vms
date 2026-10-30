"use client";

import { Avatar, cn, Popover, PopoverContent, PopoverTrigger } from "@vms/ui";
import {
  ChartColumn,
  ChevronDown,
  Languages,
  LogOut,
  Equal,
  RefreshCw,
  Settings,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { OPERATIONS_TABS } from "@/app/[locale]/operations/_components/tabs";
import { LanguageOptions } from "./LanguageSwitcher";
import { RoleOptions, useRoleSwitch } from "./RoleSwitcher";
import { useAuth } from "@/shared/auth/AuthContext";
import { roleLabel } from "@/shared/auth/roleLabels";
import { avatarUrl } from "@/shared/avatarUrl";

export function AccountMenu() {
  const t = useTranslations("nav");
  const tRoles = useTranslations("roles");
  const tLanguage = useTranslations("language");
  const { user, activeRole, logout, hasPermission } = useAuth();
  // Operations only shows when one of its tabs is open to this user.
  const canOperate = OPERATIONS_TABS.some((tab) =>
    hasPermission(tab.permission),
  );
  const router = useRouter();
  const { canSwitch } = useRoleSwitch();
  const [switching, setSwitching] = React.useState(false);
  const [choosingLanguage, setChoosingLanguage] = React.useState(false);

  async function onLogout() {
    await logout();
    router.replace("/");
  }

  const avatar = avatarUrl(user?.avatarKey);

  return (
    <Popover>
      {/* Avatar from md up; on small screens the menu is the navbar's only control, behind a hamburger. */}
      <PopoverTrigger
        aria-label={t("accountMenu")}
        className="inline-flex items-center gap-1 rounded-full text-emphasis-fg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <span className="hidden items-center gap-1 md:inline-flex">
          <Avatar name={user?.fullName ?? "User"} src={avatar} size="sm" />
          <ChevronDown className="size-4" aria-hidden="true" />
        </span>
        <span className="inline-flex size-[34px] items-center justify-center rounded-full border-[2.25px] border-emphasis-fg md:hidden">
          {/* Icon renders at 20/24 scale, so a stroke of 2.7 matches the 2.25px ring. */}
          <Equal className="size-5" strokeWidth={2.7} aria-hidden="true" />
        </span>
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
          <Link
            href="/insights"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-fg transition-colors hover:bg-surface-muted"
          >
            <ChartColumn className="size-4 text-fg-muted" aria-hidden="true" />
            {t("insights")}
          </Link>
          {canOperate ? (
            <Link
              href="/operations"
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-fg transition-colors hover:bg-surface-muted"
            >
              <Wrench className="size-4 text-fg-muted" aria-hidden="true" />
              {t("operations")}
            </Link>
          ) : null}
          {/* Small screens only: the navbar shows a Switch account pill from md up. */}
          {canSwitch ? (
            <div className="md:hidden">
              <button
                type="button"
                aria-expanded={switching}
                aria-controls="account-menu-roles"
                onClick={() => setSwitching((open) => !open)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-fg transition-colors hover:bg-surface-muted"
              >
                <RefreshCw
                  className="size-4 text-fg-muted"
                  aria-hidden="true"
                />
                <span className="flex-1 text-start">{t("switchAccount")}</span>
                <ChevronDown
                  className={cn(
                    "size-4 text-fg-muted transition-transform",
                    switching && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              {switching ? (
                <RoleOptions id="account-menu-roles" className="ps-7" />
              ) : null}
            </div>
          ) : null}
          {/* Small screens only: the navbar shows a globe button from md up. */}
          <div className="md:hidden">
            <button
              type="button"
              aria-expanded={choosingLanguage}
              aria-controls="account-menu-languages"
              onClick={() => setChoosingLanguage((open) => !open)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-fg transition-colors hover:bg-surface-muted"
            >
              <Languages className="size-4 text-fg-muted" aria-hidden="true" />
              <span className="flex-1 text-start">{tLanguage("label")}</span>
              <ChevronDown
                className={cn(
                  "size-4 text-fg-muted transition-transform",
                  choosingLanguage && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            {choosingLanguage ? (
              <LanguageOptions id="account-menu-languages" className="ps-7" />
            ) : null}
          </div>
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
