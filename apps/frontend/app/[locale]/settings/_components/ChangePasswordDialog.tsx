"use client";

import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useChangePassword } from "@/data/settings/queries";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";

/** "Change Password" → dialog (current/new/confirm). On success all sessions are
 *  revoked server-side, so we clear the local session and return to login. */
export function ChangePasswordDialog() {
  const t = useTranslations("settings");
  const changePassword = useChangePassword();
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("password.change")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("password.change")}</DialogTitle>
        </DialogHeader>
        {open ? (
          <ChangePasswordForm
            pending={changePassword.isPending}
            error={changePassword.isError}
            onSubmit={(current, next) =>
              changePassword.mutate(
                { currentPassword: current, newPassword: next },
                {
                  onSuccess: async () => {
                    setOpen(false);
                    await logout();
                    router.replace("/");
                  },
                },
              )
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error: boolean;
  onSubmit: (current: string, next: string) => void;
}) {
  const t = useTranslations("settings");
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const mismatch = confirm.length > 0 && next !== confirm;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (mismatch || next.length < 8) return;
        onSubmit(current, next);
      }}
    >
      {error ? (
        <Alert intent="danger">
          <AlertDescription>{t("password.error")}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-current">{t("password.current")}</Label>
        <Input
          id="cp-current"
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-new">{t("password.new")}</Label>
        <Input
          id="cp-new"
          type="password"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-confirm">{t("password.confirm")}</Label>
        <Input
          id="cp-confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          invalid={mismatch}
        />
        {mismatch ? (
          <span className="text-xs text-danger">{t("password.mismatch")}</span>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending} fullWidth>
          {t("password.change")}
        </Button>
      </DialogFooter>
    </form>
  );
}
