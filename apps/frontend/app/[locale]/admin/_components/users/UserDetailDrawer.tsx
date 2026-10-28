"use client";

import {
  Badge,
  Button,
  DetailDrawer,
  DetailSection,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Spinner,
} from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { ApiError } from "@/data/http/client";
import {
  useAdminUpdateUser,
  useRequestPasswordReset,
  useSetUserStatus,
  useUser,
} from "@/data/users/queries";
import type { UserDetail } from "@/data/users/users.api";
import { roleLabel } from "@/shared/auth/roleLabels";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-fg-muted">{label}</span>
      <span className="text-end text-sm font-medium text-fg">
        {value ?? "—"}
      </span>
    </div>
  );
}

/** Row-click drawer: profile, access and activity, plus the admin actions
 *  (edit profile, activate/deactivate, send a password-reset link). */
export function UserDetailDrawer({
  userId,
  onClose,
  canUpdate,
  canResetPassword,
  selfId,
}: {
  userId: string | null;
  onClose: () => void;
  canUpdate: boolean;
  canResetPassword: boolean;
  selfId: string | undefined;
}) {
  const t = useTranslations("users");
  const { data: user, isLoading, isError } = useUser(userId);

  return (
    <DetailDrawer
      open={!!userId}
      onOpenChange={(open) => !open && onClose()}
      title={user?.fullName ?? t("detail.title")}
      description={user?.email}
    >
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError || !user ? (
        <p className="text-sm text-danger">{t("detail.loadError")}</p>
      ) : (
        <DetailBody
          user={user}
          canUpdate={canUpdate}
          canResetPassword={canResetPassword}
          isSelf={user.id === selfId}
        />
      )}
    </DetailDrawer>
  );
}

function DetailBody({
  user,
  canUpdate,
  canResetPassword,
  isSelf,
}: {
  user: UserDetail;
  canUpdate: boolean;
  canResetPassword: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations("users");
  const tRoles = useTranslations("roles");
  const format = useFormatter();
  const dateTime = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium" });
  const isLocal = user.authProvider === "LOCAL";

  return (
    <>
      <DetailSection title={t("detail.profile")}>
        <Field label={t("detail.fullName")} value={user.fullName} />
        <Field label={t("detail.email")} value={user.email} />
        <Field label={t("detail.phone")} value={user.phone} />
        {user.hostDepartment ? (
          <Field label={t("detail.department")} value={user.hostDepartment} />
        ) : null}
        {user.hostOffice ? (
          <Field label={t("detail.office")} value={user.hostOffice} />
        ) : null}
      </DetailSection>

      <DetailSection title={t("detail.access")}>
        <Field
          label={t("detail.roles")}
          value={
            <span className="flex flex-wrap justify-end gap-1">
              {user.roles.map((r) => (
                <Badge key={r} intent="primary" tone="soft">
                  {roleLabel(tRoles, r)}
                </Badge>
              ))}
            </span>
          }
        />
        <Field
          label={t("detail.status")}
          value={
            <Badge intent={user.isActive ? "success" : "neutral"} tone="soft">
              {user.isActive ? t("active") : t("inactive")}
            </Badge>
          }
        />
        {!isLocal ? (
          <p className="text-xs text-fg-muted">{t("detail.sso")}</p>
        ) : null}
      </DetailSection>

      <DetailSection title={t("detail.activity")}>
        <Field
          label={t("detail.lastLogin")}
          value={
            user.lastLoginAt
              ? format.dateTime(new Date(user.lastLoginAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : t("detail.never")
          }
        />
        <Field label={t("detail.created")} value={dateTime(user.createdAt)} />
        <Field label={t("detail.updated")} value={dateTime(user.updatedAt)} />
      </DetailSection>

      {/* Keyed by user so the form re-seeds when another row opens the drawer. */}
      {canUpdate ? <EditProfileSection key={user.id} user={user} /> : null}

      {canResetPassword || canUpdate ? (
        <DetailSection title={t("detail.actions")}>
          <div className="flex flex-col gap-3">
            {canResetPassword && isLocal && user.isActive ? (
              <ResetPasswordAction userId={user.id} />
            ) : null}
            {canUpdate ? (
              <StatusAction user={user} disabled={isSelf && user.isActive} />
            ) : null}
          </div>
        </DetailSection>
      ) : null}
    </>
  );
}

function EditProfileSection({ user }: { user: UserDetail }) {
  const t = useTranslations("users");
  const update = useAdminUpdateUser();
  const [firstName, setFirstName] = React.useState(user.firstName ?? "");
  const [lastName, setLastName] = React.useState(user.lastName ?? "");
  const [phone, setPhone] = React.useState(user.phone ?? "");
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    update.mutate(
      {
        id: user.id,
        input: {
          ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
          phone: phone.trim() || null,
        },
      },
      {
        onSuccess: () => setSaved(true),
        onError: (err) =>
          setError(
            err instanceof ApiError ? err.message : t("detail.saveError"),
          ),
      },
    );
  }

  return (
    <DetailSection title={t("detail.editProfile")} collapsible defaultOpen={false}>
      <form className="flex flex-col gap-3" onSubmit={save}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="detail-first-name">{t("detail.firstName")}</Label>
          <Input
            id="detail-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="detail-last-name">{t("detail.lastName")}</Label>
          <Input
            id="detail-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="detail-phone">{t("detail.phone")}</Label>
          <Input
            id="detail-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {saved ? <p className="text-sm text-success">{t("detail.saved")}</p> : null}
        <Button type="submit" disabled={update.isPending}>
          {t("detail.save")}
        </Button>
      </form>
    </DetailSection>
  );
}

function ResetPasswordAction({ userId }: { userId: string }) {
  const t = useTranslations("users");
  const reset = useRequestPasswordReset();
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function send() {
    setSent(false);
    setError(null);
    reset.mutate(userId, {
      onSuccess: () => setSent(true),
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : t("reset.error")),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        intent="neutral"
        tone="outline"
        disabled={reset.isPending}
        onClick={send}
      >
        {t("reset.action")}
      </Button>
      {sent ? <p className="text-sm text-success">{t("reset.sent")}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function StatusAction({
  user,
  disabled,
}: {
  user: UserDetail;
  disabled: boolean;
}) {
  const t = useTranslations("users");
  const setStatus = useSetUserStatus();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const deactivating = user.isActive;

  function confirm() {
    setError(null);
    setStatus.mutate(
      { id: user.id, isActive: !user.isActive },
      {
        onSuccess: () => setConfirming(false),
        onError: (err) =>
          setError(
            err instanceof ApiError ? err.message : t("statusAction.error"),
          ),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        intent={deactivating ? "danger" : "primary"}
        tone="outline"
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        {deactivating
          ? t("statusAction.deactivate")
          : t("statusAction.activate")}
      </Button>
      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          setError(null);
          setConfirming(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deactivating
                ? t("statusAction.confirmDeactivateTitle")
                : t("statusAction.confirmActivateTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg-muted">
              {deactivating
                ? t("statusAction.confirmDeactivateBody", {
                    name: user.fullName,
                  })
                : t("statusAction.confirmActivateBody", {
                    name: user.fullName,
                  })}
            </p>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <DialogFooter>
              <Button
                intent="neutral"
                tone="outline"
                onClick={() => setConfirming(false)}
              >
                {t("form.cancel")}
              </Button>
              <Button
                intent={deactivating ? "danger" : "primary"}
                disabled={setStatus.isPending}
                onClick={confirm}
              >
                {deactivating
                  ? t("statusAction.deactivate")
                  : t("statusAction.activate")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
