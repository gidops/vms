"use client";

import {
  Badge,
  Button,
  EmptyState,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { Trash2, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { AdminShell } from "@/app/[locale]/admin/_components/AdminShell";
import {
  CreateUserDialog,
  DeleteUserDialog,
  EditRolesDialog,
} from "@/app/[locale]/admin/_components/users/UserDialogs";
import {
  useCreateUser,
  useRoles,
  useUpdateUserRoles,
  useUsers,
} from "@/data/users/queries";
import type { UserListItem } from "@/data/users/users.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { roleLabel } from "@/shared/auth/roleLabels";

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
    <AdminShell active="users">
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
    </AdminShell>
  );
}

export default function UsersPage() {
  return (
    <RouteGuard home="/admin">
      <Users_ />
    </RouteGuard>
  );
}
