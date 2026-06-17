"use client";

import { Card, CardContent, CardHeader, CardTitle, TopNavShell } from "@vms/ui";
import { useTranslations } from "next-intl";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";

function Staff() {
  const t = useTranslations("staff");
  const { user } = useAuth();
  return (
    <TopNavShell nav={<AppTopNav />}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-fg">
            {t("welcome", { name: user?.fullName ?? "" })}
          </h1>
          <p className="text-fg-muted">{t("subtitle")}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("placeholderTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-fg-muted">{t("placeholderBody")}</p>
          </CardContent>
        </Card>
      </div>
    </TopNavShell>
  );
}

export default function StaffPage() {
  return (
    <RouteGuard home="/staff">
      <Staff />
    </RouteGuard>
  );
}
