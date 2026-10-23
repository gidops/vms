"use client";

import { PERMISSIONS } from "@vms/contracts";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TopNavShell,
} from "@vms/ui";
import { LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";

function Gate() {
  const t = useTranslations("gate");
  const { user, hasPermission } = useAuth();
  return (
    <TopNavShell nav={<AppTopNav />}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-fg">
            {t("welcome", { name: user?.fullName ?? "" })}
          </h1>
          <p className="text-fg-muted">{t("subtitle")}</p>
        </div>
        {hasPermission(PERMISSIONS.EVACUATION_READ) ? (
          <Button asChild intent="primary" className="self-start">
            <Link href="/gate/evacuation">
              <LifeBuoy className="size-4" aria-hidden="true" />
              {t("evacuationRoll")}
            </Link>
          </Button>
        ) : null}
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

export default function GatePage() {
  return (
    <RouteGuard home="/gate">
      <Gate />
    </RouteGuard>
  );
}
