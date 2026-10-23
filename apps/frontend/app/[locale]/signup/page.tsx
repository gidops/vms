"use client";

import {
  Alert,
  AlertDescription,
  AuthLayout,
  Button,
  Input,
  Label,
  Spinner,
} from "@vms/ui";
import { Lock, Mail, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { authApi } from "@/data/auth/auth.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { useAuthBrand } from "../_components/AuthBrand";

export default function SignupPage() {
  const t = useTranslations("signup");
  const brand = useAuthBrand();
  const { signup } = useAuth();
  const router = useRouter();

  const [available, setAvailable] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void authApi
      .signupAvailable()
      .then((r) => setAvailable(r.available))
      .catch(() => setAvailable(false));
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, fullName, password);
      router.replace("/admin");
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (available === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas text-primary">
        <Spinner className="size-8" />
      </main>
    );
  }

  if (!available) {
    return (
      <AuthLayout
        {...brand}
        title={t("closedTitle")}
        description={t("closedSubtitle")}
      >
        <Button asChild fullWidth>
          <Link href="/">{t("goToLogin")}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      {...brand}
      title={t("title")}
      description={t("subtitle")}
      footer={
        <p className="text-center text-sm text-fg-muted">
          <Link href="/" className="text-primary hover:underline">
            {t("goToLogin")}
          </Link>
        </p>
      }
    >
      {error ? (
        <Alert intent="danger" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">{t("fullName")}</Label>
          <Input
            id="fullName"
            required
            startIcon={<User />}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("fullNamePlaceholder")}
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={8}
            startIcon={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
          />
        </div>
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
