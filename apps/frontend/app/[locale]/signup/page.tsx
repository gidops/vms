"use client";

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Spinner,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { authApi } from "@/data/auth/auth.api";
import { useAuth } from "@/shared/auth/AuthContext";

export default function SignupPage() {
  const t = useTranslations("signup");
  const tApp = useTranslations("app");
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
      <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-xl">{t("closedTitle")}</CardTitle>
            <p className="text-sm text-fg-muted">{t("closedSubtitle")}</p>
          </CardHeader>
          <CardContent>
            <Button asChild fullWidth>
              <Link href="/">{t("goToLogin")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="text-sm font-semibold text-primary">
            {tApp("name")}
          </span>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <p className="text-sm text-fg-muted">{t("subtitle")}</p>
        </CardHeader>
        <CardContent>
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
              />
            </div>
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-fg-muted">
            <Link href="/" className="text-primary hover:underline">
              {t("goToLogin")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
