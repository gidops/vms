"use client";

import { SideNav, TopNavShell } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { ADMIN_SECTIONS, type AdminSection } from "./adminAccess";

export interface AdminShellProps {
  /** Highlighted sidebar section. */
  active: AdminSection;
  /** Optional global search field for the top nav. */
  search?: React.ReactNode;
  filterBar?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Admin console frame: brand top nav (search, notifications, role switcher,
 * account) over a permission-filtered section sidebar.
 */
export function AdminShell({
  active,
  search,
  filterBar,
  children,
}: AdminShellProps) {
  const t = useTranslations("admin.nav");
  const { hasPermission } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);

  const items = ADMIN_SECTIONS.filter(
    (s) => !s.permission || hasPermission(s.permission),
  ).map((s) => ({
    key: s.key,
    label: t(s.key),
    icon: s.icon,
    href: s.href,
    active: s.key === active,
    disabled: !s.href,
    disabledHint: s.href ? undefined : t("comingSoon"),
  }));

  return (
    <TopNavShell
      nav={
        <>
          <AppTopNav search={search} notificationsHref="/admin/activity" />
          <nav
            aria-label={t("label")}
            className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-surface px-4 py-2 md:hidden"
          >
            {items
              .filter((item) => !item.disabled)
              .map((item) => (
                <Link
                  key={item.key}
                  href={item.href!}
                  aria-current={item.active ? "page" : undefined}
                  className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary-subtle aria-[current=page]:bg-primary-subtle"
                >
                  {item.label}
                </Link>
              ))}
          </nav>
        </>
      }
      filterBar={filterBar}
      sidebar={
        <SideNav
          label={t("label")}
          items={items}
          linkAs={Link}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          collapseLabel={t("collapse")}
          expandLabel={t("expand")}
        />
      }
    >
      {children}
    </TopNavShell>
  );
}
