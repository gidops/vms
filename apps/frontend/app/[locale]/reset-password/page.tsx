"use client";

import {
  Alert,
  AlertDescription,
  AuthLayout,
  Button,
  Label,
  PasswordInput,
  Spinner,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { authApi } from "@/data/auth/auth.api";
import { Link } from "@/i18n/navigation";
import { useAuthBrand } from "../_components/AuthBrand";

/** Landing page for the admin-issued reset email. The token in the link is the
 *  only credential: it is checked on load (so an expired link fails fast) and
 *  consumed by the submit. A completed reset revokes every session server-side. */
function ResetPasswordScreen() {
  const t = useTranslations("resetPassword");
  const brand = useAuthBrand();
  const token = useSearchParams().get("token") ?? "";

  // A missing token is known invalid immediately; a present one gets checked.
  const [tokenState, setTokenState] = React.useState<
    "checking" | "valid" | "invalid"
  >(token ? "checking" : "invalid");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    void authApi
      .validateResetToken(token)
      .then((r) => setTokenState(r.valid ? "valid" : "invalid"))
      .catch(() => setTokenState("invalid"));
  }, [token]);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm || password.length < 8) return;
    setError(null);
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (tokenState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas text-primary">
        <Spinner className="size-8" />
      </main>
    );
  }

  if (tokenState === "invalid") {
    return (
      <AuthLayout
        {...brand}
        title={t("invalidTitle")}
        description={t("invalidBody")}
      >
        <Button asChild fullWidth>
          <Link href="/">{t("toLogin")}</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        {...brand}
        title={t("successTitle")}
        description={t("successBody")}
      >
        <Button asChild fullWidth>
          <Link href="/">{t("toLogin")}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...brand} title={t("title")} description={t("body")}>
      {error ? (
        <Alert intent="danger" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">{t("newPassword")}</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {tooShort ? (
            <p className="text-sm text-danger">{t("minLength")}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch ? (
            <p className="text-sm text-danger">{t("mismatch")}</p>
          ) : null}
        </div>
        <Button
          type="submit"
          fullWidth
          disabled={submitting || mismatch || tooShort || !password || !confirm}
        >
          {t("submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense>
      <ResetPasswordScreen />
    </React.Suspense>
  );
}
