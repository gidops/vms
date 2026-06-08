"use client";

import { Spinner } from "@vms/ui";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "./AuthContext";

/** Client-side route protection: redirects unauthenticated users to login. */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-primary">
        <Spinner className="size-8" />
      </div>
    );
  }

  return <>{children}</>;
}
