"use client";

import { homeFor, ROLES } from "@vms/contracts";
import { Alert, AlertDescription, cn } from "@vms/ui";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";

/**
 * Direct one-tap toggle between the VMC (reception) and Staff dashboards. Shown
 * only when the user holds the role for the *other* app and is currently in a
 * VMC/Staff context. Switching re-mints the scoped token and lands on that
 * app's home route.
 *
 * This is a fast-path for the common case of a user who holds exactly the
 * VMC + Staff pair. Anyone with a different role combination gets the general
 * `RoleSwitcher` instead — see the branching in `AppTopNav`.
 */
export function AppSwitcher() {
  const t = useTranslations("nav");
  const { user, activeRole, switchRole } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const isStaff = activeRole === ROLES.STAFF;
  const target = isStaff ? ROLES.VMC : ROLES.STAFF;
  const roles = user?.roles ?? [];

  // Only offer the toggle when the user can land on the other side from a
  // VMC/Staff dashboard.
  if (!roles.includes(target)) return null;
  if (activeRole !== ROLES.VMC && activeRole !== ROLES.STAFF) return null;

  async function onSwitch() {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      const profile = await switchRole(target);
      router.replace(homeFor(profile.activeRole));
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void onSwitch()}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-emphasis-border px-4 py-1.5 text-sm font-medium text-emphasis-fg transition-colors outline-none",
          "hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {isStaff ? t("switchToVmc") : t("switchToStaff")}
      </button>
      {error ? (
        <Alert
          intent="danger"
          className="absolute end-0 top-full z-dropdown mt-2 w-64"
        >
          <AlertDescription>{t("switchError")}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
