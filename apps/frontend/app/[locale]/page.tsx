"use client";

import {
  Alert,
  AlertDescription,
  AuthLayout,
  Button,
  Input,
  Label,
} from "@vms/ui";
import { homeFor } from "@vms/contracts";
import { Lock, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { useAuthBrand } from "./_components/AuthBrand";

export default function LoginPage() {
  const t = useTranslations("login");
  const brand = useAuthBrand();
  const { login, status, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (e.g. returning visit) → go to your role's home.
  useEffect(() => {
    if (status === "authenticated") router.replace(homeFor(user?.activeRole));
  }, [status, user, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const profile = await login(email, password);
      router.replace(homeFor(profile.activeRole));
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      {...brand}
      title={t("title")}
      footer={
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-xs text-fg-subtle">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          {/* Placeholder — Okta SSO wiring lands with the OIDC provider. */}
          <Button
            type="button"
            intent="neutral"
            tone="outline"
            fullWidth
            disabled
          >
            {t("okta")}
          </Button>
        </div>
      }
    >
      {error ? (
        <Alert intent="danger" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            startIcon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            startIcon={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
          />
          <Link
            href="/forgot-password"
            className="self-end text-sm text-fg-muted hover:text-primary hover:underline"
          >
            {t("forgot")}
          </Link>
        </div>

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? t("signingIn") : t("submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
