"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TopNavShell,
} from "@vms/ui";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { PendingRequests } from "@/app/[locale]/admin/_components/PendingRequests";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";

function Admin() {
  const t = useTranslations("admin");
  const { user, hasPermission } = useAuth();
  return (
    <TopNavShell nav={<AppTopNav />}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-fg">
            {t("welcome", { name: user?.fullName ?? "" })}
          </h1>
          <p className="text-fg-muted">{t("subtitle")}</p>
        </div>

        {hasPermission("visit:approve") ? <PendingRequests /> : null}

        {hasPermission("user:read") ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("userManagement")}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-fg-muted">{t("userManagementBody")}</p>
              <Button asChild>
                <Link href="/admin/users">
                  <Users className="size-4" aria-hidden="true" />
                  {t("manageUsers")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </TopNavShell>
  );
}

export default function AdminPage() {
  return (
    <RouteGuard home="/admin">
      <Admin />
    </RouteGuard>
  );
}
