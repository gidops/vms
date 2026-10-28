"use client";

import { nameParts } from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  Avatar,
  Badge,
  Button,
  DetailDrawer,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Spinner,
} from "@vms/ui";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Field } from "@/app/[locale]/_components/visit-detail/helpers";
import { SheetSection } from "@/app/[locale]/_components/visit-detail/sections/SheetSection";
import { ApiError } from "@/data/http/client";
import {
  useAdminUpdateUser,
  useRequestPasswordReset,
  useSetUserStatus,
  useUser,
} from "@/data/users/queries";
import type { UserDetail } from "@/data/users/users.api";
import { roleLabel } from "@/shared/auth/roleLabels";
import { formatWatDateTime } from "@/shared/wat";

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

/** Outcome of a footer action, shown at the top of the sheet body while the
 *  same user is open. */
type Notice = { userId: string; intent: "success" | "danger"; text: string };

/** Row-click sheet: profile, access and activity, with the admin actions
 *  (send a password-reset link, activate/deactivate) in the footer. */
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
  const reset = useRequestPasswordReset();
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const shownNotice = notice?.userId === userId ? notice : null;

  const showReset =
    !!user &&
    canResetPassword &&
    user.authProvider === "LOCAL" &&
    user.isActive;
  const showStatus = !!user && canUpdate;

  const sendReset = (id: string) => {
    setNotice(null);
    reset.mutate(id, {
      onSuccess: () =>
        setNotice({ userId: id, intent: "success", text: t("reset.sent") }),
      onError: (err) =>
        setNotice({
          userId: id,
          intent: "danger",
          text: errorText(err, t("reset.error")),
        }),
    });
  };

  const footer =
    user && (showReset || showStatus) ? (
      <>
        {showReset ? (
          <Button
            intent="neutral"
            tone="outline"
            size="sm"
            disabled={reset.isPending}
            onClick={() => sendReset(user.id)}
          >
            {t("reset.action")}
          </Button>
        ) : null}
        {showStatus ? (
          <Button
            intent={user.isActive ? "danger" : "primary"}
            tone={user.isActive ? "outline" : "solid"}
            size="sm"
            disabled={user.id === selfId && user.isActive}
            onClick={() => setConfirming(true)}
          >
            {user.isActive
              ? t("statusAction.deactivate")
              : t("statusAction.activate")}
          </Button>
        ) : null}
      </>
    ) : undefined;

  return (
    <DetailDrawer
      open={!!userId}
      side="start"
      onOpenChange={(open) => !open && onClose()}
      title={t("detail.title")}
      footer={footer}
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : isError || !user ? (
        <Alert intent="danger">
          <AlertDescription>{t("detail.loadError")}</AlertDescription>
        </Alert>
      ) : (
        <>
          {shownNotice ? (
            <Alert intent={shownNotice.intent}>
              <AlertDescription>{shownNotice.text}</AlertDescription>
            </Alert>
          ) : null}
          <DetailBody user={user} canUpdate={canUpdate} />
          {showStatus ? (
            <StatusDialog
              user={user}
              open={confirming}
              onOpenChange={setConfirming}
              onChanged={() => setNotice(null)}
            />
          ) : null}
        </>
      )}
    </DetailDrawer>
  );
}

function DetailBody({
  user,
  canUpdate,
}: {
  user: UserDetail;
  canUpdate: boolean;
}) {
  const t = useTranslations("users");
  const tRoles = useTranslations("roles");
  const locale = useLocale();
  const date = (d: string | null) => (d ? formatWatDateTime(d, locale) : "—");

  return (
    <>
      <SheetSection title={t("detail.profile")}>
        <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={user.fullName} size="md" />
            <div className="flex min-w-0 flex-col">
              <span className="font-medium text-fg">{user.fullName}</span>
              <span className="text-sm text-fg-muted">
                {user.email}
                {user.phone ? ` · ${user.phone}` : ""}
              </span>
            </div>
          </div>
          <Badge intent={user.isActive ? "success" : "neutral"}>
            {user.isActive ? t("active") : t("inactive")}
          </Badge>
        </div>
      </SheetSection>

      <SheetSection title={t("detail.access")}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label={t("detail.roles")}>
              <span className="flex flex-wrap gap-1">
                {user.roles.map((r) => (
                  <Badge key={r} intent="primary" tone="soft">
                    {roleLabel(tRoles, r)}
                  </Badge>
                ))}
              </span>
            </Field>
          </div>
          {user.hostDepartment ? (
            <Field label={t("detail.department")}>{user.hostDepartment}</Field>
          ) : null}
          {user.hostOffice ? (
            <Field label={t("detail.office")}>{user.hostOffice}</Field>
          ) : null}
        </div>
        {user.authProvider !== "LOCAL" ? (
          <p className="mt-3 text-xs text-fg-muted">{t("detail.sso")}</p>
        ) : null}
      </SheetSection>

      <SheetSection title={t("detail.activity")}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label={t("detail.lastLogin")}>
              {user.lastLoginAt ? date(user.lastLoginAt) : t("detail.never")}
            </Field>
          </div>
          <Field label={t("detail.created")}>{date(user.createdAt)}</Field>
          <Field label={t("detail.updated")}>{date(user.updatedAt)}</Field>
        </div>
      </SheetSection>

      {/* Keyed by user so the form re-seeds when another row opens the sheet. */}
      {canUpdate ? <EditProfileSection key={user.id} user={user} /> : null}
    </>
  );
}

function EditProfileSection({ user }: { user: UserDetail }) {
  const t = useTranslations("users");
  const update = useAdminUpdateUser();
  // Older accounts hold only fullName; split it so neither field opens blank.
  const initial = nameParts(user);
  const [firstName, setFirstName] = React.useState(initial.firstName);
  const [lastName, setLastName] = React.useState(initial.lastName);
  const [phone, setPhone] = React.useState(user.phone ?? "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      id: user.id,
      input: {
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        phone: phone.trim() || null,
      },
    });
  }

  return (
    <SheetSection title={t("detail.editProfile")} defaultOpen={false}>
      <form className="flex flex-col gap-3" onSubmit={save}>
        <div className="grid grid-cols-2 gap-3">
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
        {update.isError ? (
          <span className="text-xs text-danger" role="alert">
            {errorText(update.error, t("detail.saveError"))}
          </span>
        ) : null}
        {update.isSuccess ? (
          <span className="text-xs text-success" role="status">
            {t("detail.saved")}
          </span>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            intent="neutral"
            tone="outline"
            disabled={update.isPending}
          >
            {t("detail.save")}
          </Button>
        </div>
      </form>
    </SheetSection>
  );
}

/** Confirms activate/deactivate; deactivating signs the user out everywhere. */
function StatusDialog({
  user,
  open,
  onOpenChange,
  onChanged,
}: {
  user: UserDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("users");
  const setStatus = useSetUserStatus();
  const deactivating = user.isActive;

  function confirm() {
    setStatus.mutate(
      { id: user.id, isActive: !user.isActive },
      {
        onSuccess: () => {
          onChanged();
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setStatus.reset();
        onOpenChange(o);
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
              ? t("statusAction.confirmDeactivateBody", { name: user.fullName })
              : t("statusAction.confirmActivateBody", { name: user.fullName })}
          </p>
          {setStatus.isError ? (
            <span className="text-xs text-danger" role="alert">
              {errorText(setStatus.error, t("statusAction.error"))}
            </span>
          ) : null}
          <DialogFooter>
            <Button
              intent="neutral"
              tone="outline"
              onClick={() => onOpenChange(false)}
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
  );
}
