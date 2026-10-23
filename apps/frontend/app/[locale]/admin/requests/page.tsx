"use client";

import { useTranslations } from "next-intl";
import { AdminShell } from "@/app/[locale]/admin/_components/AdminShell";
import { PendingRequests } from "@/app/[locale]/admin/_components/PendingRequests";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Requests & Approvals: the admin approval queue inside the console frame. */
function Requests() {
  const t = useTranslations("admin.requests");
  return (
    <AdminShell active="requests">
      <div className="flex max-w-3xl flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-fg">{t("title")}</h1>
          <p className="text-sm text-fg-muted">{t("subtitle")}</p>
        </header>
        <PendingRequests />
      </div>
    </AdminShell>
  );
}

export default function AdminRequestsPage() {
  return (
    <RouteGuard home="/admin">
      <Requests />
    </RouteGuard>
  );
}
