"use client";

import { homeFor, ROLES } from "@vms/contracts";
import { cn } from "@vms/ui";
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
 */
export function AppSwitcher() {
  const t = useTranslations("nav");
  const { user, activeRole, switchRole } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

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
    try {
      const profile = await switchRole(target);
      router.replace(homeFor(profile.activeRole));
    } finally {
      setPending(false);
    }
  }

  return (
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
  );
}
