"use client";

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TopNavShell,
} from "@vms/ui";
import { Trash2, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { ApiError } from "@/data/http/client";
import {
  useCreateUser,
  useDeleteUser,
  useRoles,
  useUpdateUserRoles,
  useUsers,
} from "@/data/users/queries";
import type { UserListItem } from "@/data/users/users.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { roleLabel } from "@/shared/auth/roleLabels";

function RoleChecklist({
  roles,
  selected,
  onToggle,
}: {
  roles: string[];
  selected: Set<string>;
  onToggle: (role: string) => void;
}) {
  const tRoles = useTranslations("roles");
  return (
    <div className="flex flex-col gap-2">
      {roles.map((role) => (
        <label key={role} className="flex items-center gap-2 text-sm text-fg">
          <Checkbox
            checked={selected.has(role)}
            onCheckedChange={() => onToggle(role)}
          />
          {roleLabel(tRoles, role)}
        </label>
      ))}
    </div>
  );
}

function Users_() {
  const t = useTranslations("users");
  const tRoles = useTranslations("roles");
  const format = useFormatter();
  const { user } = useAuth();
  const { data, isLoading } = useUsers();
  const { data: roles = [] } = useRoles();
  const createUser = useCreateUser();
  const updateRoles = useUpdateUserRoles();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserListItem | null>(null);
  const [deleting, setDeleting] = React.useState<UserListItem | null>(null);

  const items = data?.items ?? [];

  return (
    <TopNavShell nav={<AppTopNav />}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-primary">{t("title")}</h1>
          <Button onClick={() => setCreateOpen(true)}>{t("newUser")}</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Users} title={t("empty")} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.user")}</TableHead>
                  <TableHead>{t("columns.roles")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead>{t("columns.created")}</TableHead>
                  <TableHead>{t("columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody striped>
                {items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-medium text-fg">
                          {u.fullName}
                        </span>
                        <span className="text-xs text-fg-muted">{u.email}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} intent="primary" tone="soft">
                            {roleLabel(tRoles, r)}
                          </Badge>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        intent={u.isActive ? "success" : "neutral"}
                        tone="soft"
                      >
                        {u.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {format.dateTime(new Date(u.createdAt), {
                        dateStyle: "medium",
                      })}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Button
                          intent="neutral"
                          tone="outline"
                          size="sm"
                          onClick={() => setEditing(u)}
                        >
                          {t("editRoles")}
                        </Button>
                        <Button
                          intent="danger"
                          tone="ghost"
                          size="sm"
                          aria-label={t("delete")}
                          disabled={u.id === user?.id}
                          onClick={() => setDeleting(u)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
        pending={createUser.isPending}
        onSubmit={(input) =>
          createUser.mutate(input, { onSuccess: () => setCreateOpen(false) })
        }
      />
      <EditRolesDialog
        user={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        roles={roles}
        pending={updateRoles.isPending}
        onSubmit={(id, next) =>
          updateRoles.mutate(
            { id, roles: next },
            { onSuccess: () => setEditing(null) },
          )
        }
      />
      <DeleteUserDialog
        user={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => setDeleting(null)}
      />
    </TopNavShell>
  );
}

/** Toggle helper shared by the create + edit forms. */
function useRoleSelection(initial: string[]) {
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initial),
  );
  const toggle = (role: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  return { selected, toggle };
}

function CreateUserDialog({
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

function CreateUserForm({
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

function EditRolesDialog({
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

function EditRolesForm({
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

function DeleteUserDialog({
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

export default function UsersPage() {
  return (
    <RouteGuard home="/admin">
      <Users_ />
    </RouteGuard>
  );
}
