"use client";

import { homeFor } from "@vms/contracts";
import { Spinner } from "@vms/ui";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "./AuthContext";

export interface RouteGuardProps {
  children: React.ReactNode;
  /**
   * The home route this page belongs to (e.g. "/admin"). When set, an
   * authenticated user whose active role lands elsewhere is redirected to their
   * own home — so a VMC-active user can't view the admin dashboard.
   */
  home?: string;
}

/** Client-side route protection: auth gate + optional active-role match. */
export function RouteGuard({ children, home }: RouteGuardProps) {
  const { status, activeRole } = useAuth();
  const router = useRouter();

  const mismatched =
    status === "authenticated" && home != null && homeFor(activeRole) !== home;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    } else if (mismatched) {
      router.replace(homeFor(activeRole));
    }
  }, [status, mismatched, activeRole, router]);

  if (status !== "authenticated" || mismatched) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-primary">
        <Spinner className="size-8" />
      </div>
    );
  }

  return <>{children}</>;
}
