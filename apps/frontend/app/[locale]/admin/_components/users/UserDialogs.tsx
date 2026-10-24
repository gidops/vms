"use client";

import { ADDON_ROLES, isAddonRole } from "@vms/contracts";
import {
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { ApiError } from "@/data/http/client";
import { useDeleteUser } from "@/data/users/queries";
import type { UserListItem } from "@/data/users/users.api";
import { roleLabel } from "@/shared/auth/roleLabels";

/*
 * User-management dialogs and forms, shared by the original admin Users page
 * and the admin console v2 Users tab.
 */

export function RoleChecklist({
  roles,
  selected,
  onToggle,
}: {
  roles: string[];
  selected: Set<string>;
  onToggle: (role: string) => void;
}) {
  const t = useTranslations("users");
  const tRoles = useTranslations("roles");
  // Main roles first; each add-on sits under them and needs its base role.
  const ordered = [
    ...roles.filter((r) => !isAddonRole(r)),
    ...roles.filter(isAddonRole),
  ];
  return (
    <div className="flex flex-col gap-2">
      {ordered.map((role) => {
        const base = ADDON_ROLES[role];
        const disabled = !!base && !selected.has(base);
        return (
          <label
            key={role}
            className={cn(
              "flex items-start gap-2 text-sm text-fg",
              base && "ps-6",
              disabled && "opacity-50",
            )}
          >
            <Checkbox
              className="mt-0.5"
              checked={selected.has(role)}
              disabled={disabled}
              onCheckedChange={() => onToggle(role)}
            />
            <span className="flex flex-col">
              {roleLabel(tRoles, role)}
              {base ? (
                <span className="text-xs text-fg-subtle">
                  {t("form.addonHint", { base: roleLabel(tRoles, base) })}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Toggle helper shared by the create + edit forms. */
export function useRoleSelection(initial: string[]) {
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initial),
  );
  const toggle = (role: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
        // Dropping a base role drops the add-ons that extend it.
        for (const [addon, base] of Object.entries(ADDON_ROLES)) {
          if (base === role) next.delete(addon);
        }
      } else next.add(role);
      return next;
    });
  return { selected, toggle };
}

export function CreateUserDialog({
  open,
  onOpenChange,
  roles,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: string[];
  pending: boolean;
  onSubmit: (input: {
    email: string;
    fullName: string;
    password: string;
    roles: string[];
  }) => void;
}) {
  const t = useTranslations("users");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newUser")}</DialogTitle>
        </DialogHeader>
        {/* Mounted only while open, so the form resets naturally on reopen. */}
        <CreateUserForm roles={roles} pending={pending} onSubmit={onSubmit} />
      </DialogContent>
    </Dialog>
  );
}

export function CreateUserForm({
  roles,
  pending,
  onSubmit,
}: {
  roles: string[];
  pending: boolean;
  onSubmit: (input: {
    email: string;
    fullName: string;
    password: string;
    roles: string[];
  }) => void;
}) {
  const t = useTranslations("users");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const { selected, toggle } = useRoleSelection([]);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected.size === 0) return;
        onSubmit({ fullName, email, password, roles: [...selected] });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cu-name">{t("form.fullName")}</Label>
        <Input
          id="cu-name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cu-email">{t("form.email")}</Label>
        <Input
          id="cu-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cu-pw">{t("form.password")}</Label>
        <Input
          id="cu-pw"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("form.roles")}</Label>
        <RoleChecklist roles={roles} selected={selected} onToggle={toggle} />
      </div>
      <DialogFooter>
        <Button
          type="submit"
          disabled={pending || selected.size === 0}
          fullWidth
        >
          {t("form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditRolesDialog({
  user,
  onOpenChange,
  roles,
  pending,
  onSubmit,
}: {
  user: UserListItem | null;
  onOpenChange: (open: boolean) => void;
  roles: string[];
  pending: boolean;
  onSubmit: (id: string, roles: string[]) => void;
}) {
  const t = useTranslations("users");
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("editRolesFor", { name: user?.fullName ?? "" })}
          </DialogTitle>
        </DialogHeader>
        {/* key remounts the form (fresh state) when a different user is edited. */}
        {user ? (
          <EditRolesForm
            key={user.id}
            initialRoles={user.roles}
            roles={roles}
            pending={pending}
            onSubmit={(next) => onSubmit(user.id, next)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function EditRolesForm({
  initialRoles,
  roles,
  pending,
  onSubmit,
}: {
  initialRoles: string[];
  roles: string[];
  pending: boolean;
  onSubmit: (roles: string[]) => void;
}) {
  const t = useTranslations("users");
  const { selected, toggle } = useRoleSelection(initialRoles);
  return (
    <div className="flex flex-col gap-4">
      <RoleChecklist roles={roles} selected={selected} onToggle={toggle} />
      <DialogFooter>
        <Button
          disabled={pending || selected.size === 0}
          fullWidth
          onClick={() => onSubmit([...selected])}
        >
          {t("form.save")}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function DeleteUserDialog({
  user,
  onOpenChange,
  onDeleted,
}: {
  user: UserListItem | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("users");
  const deleteUser = useDeleteUser();
  const [error, setError] = React.useState<string | null>(null);

  function confirm() {
    if (!user) return;
    setError(null);
    deleteUser.mutate(user.id, {
      onSuccess: onDeleted,
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : t("deleteError")),
    });
  }

  return (
    <Dialog
      open={!!user}
      onOpenChange={(open) => {
        setError(null);
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg-muted">
            {t("deleteConfirmBody", { name: user?.fullName ?? "" })}
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <DialogFooter>
            <Button
              intent="neutral"
              tone="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("form.cancel")}
            </Button>
            <Button
              intent="danger"
              disabled={deleteUser.isPending}
              onClick={confirm}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
