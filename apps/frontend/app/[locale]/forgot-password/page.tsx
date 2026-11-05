"use client";

import { AuthLayout, Button } from "@vms/ui";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuthBrand } from "../_components/AuthBrand";

// Self-service reset has no backend yet; password resets go through an admin.
export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const brand = useAuthBrand();
  return (
    <AuthLayout {...brand} title={t("title")} description={t("body")}>
      <Button asChild fullWidth>
        <Link href="/">{t("back")}</Link>
      </Button>
    </AuthLayout>
  );
}
