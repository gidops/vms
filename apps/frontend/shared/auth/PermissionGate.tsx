"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "./AuthContext";

/**
 * Renders children only when the active role holds `permission`; otherwise a
 * plain "no access" note. The API enforces the same permission, so this is a
 * courtesy for a deep link, not the security boundary.
 */
export function PermissionGate({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return (
      <p role="alert" className="py-10 text-center text-fg-muted">
        {t("noAccess")}
      </p>
    );
  }
  return <>{children}</>;
}
