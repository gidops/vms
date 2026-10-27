"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "./AuthContext";

/** A courtesy for deep links; the API enforces the same permission. */
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
