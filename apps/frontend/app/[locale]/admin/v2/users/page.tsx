"use client";

import { PERMISSIONS } from "@vms/contracts";
import {
  Badge,
  Button,
  EmptyState,
  FilterBar,
  Pagination,
  RecordTable,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TopNavShell,
} from "@vms/ui";
import { Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
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
import { UserFormDrawer } from "../_components/users/UserFormDrawer";

const ALL = "all";
const PAGE_SIZE = 10;

/** `?layout=drawer` opens create/edit as a leading-edge drawer; read-only roles see the table only. */
function UsersTab() {
  const t = useTranslations("users");
  const tV2 = useTranslations("adminV2.users");
  const tRoles = useTranslations("roles");
  const format = useFormatter();
  const drawer = useSearchParams().get("layout") === "drawer";
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.USER_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.USER_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.USER_DELETE);
  const hasActions = canUpdate || canDelete;

  const { data, isLoading } = useUsers();
  const { data: roles = [] } = useRoles();
  const createUser = useCreateUser();
  const updateRoles = useUpdateUserRoles();

  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState(ALL);
  const [page, setPage] = React.useState(1);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserListItem | null>(null);
  const [deleting, setDeleting] = React.useState<UserListItem | null>(null);

  // The users API returns a single page (≤100), so filter + page client-side.
  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (u) =>
        (role === ALL || u.roles.includes(role)) &&
        (!term ||
          u.fullName.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term)),
    );
  }, [data, search, role]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onCreate = (input: Parameters<typeof createUser.mutate>[0]) =>
    createUser.mutate(input, { onSuccess: () => setCreateOpen(false) });
  const onUpdateRoles = (id: string, next: string[]) =>
    updateRoles.mutate(
      { id, roles: next },
      { onSuccess: () => setEditing(null) },
    );

  return (
    <TopNavShell
      nav={<AppTopNav app="admin" active="users" />}
      filterBar={
        <FilterBar>
          <div className="min-w-56 flex-1">
            <SearchInput
              placeholder={tV2("searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              onClear={() => setSearch("")}
            />
          </div>
          <Select
            value={role}
            onValueChange={(v) => {
              setRole(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{tV2("allRoles")}</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(tRoles, r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-stretch justify-between overflow-hidden rounded-xl border-x border-b border-border bg-surface">
          <h1 className="flex items-center px-6 py-4 text-3xl font-semibold text-fg">
            {t("title")}
          </h1>
          {canCreate ? (
            <div className="flex items-center bg-primary-subtle px-6 py-3">
              <Button onClick={() => setCreateOpen(true)}>
                {t("newUser")}
              </Button>
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title={t("empty")} />
        ) : (
          <RecordTable
            frameless
            pagination={
              totalPages > 1 ? (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              ) : undefined
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.user")}</TableHead>
                  <TableHead>{t("columns.roles")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead>{t("columns.created")}</TableHead>
                  {hasActions ? (
                    <TableHead>{t("columns.actions")}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody striped>
                {rows.map((u) => (
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
                    {hasActions ? (
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {canUpdate ? (
                            <Button
                              intent="neutral"
                              tone="outline"
                              size="sm"
                              className="min-w-28 text-xs"
                              onClick={() => setEditing(u)}
                            >
                              {t("editRoles")}
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              intent="danger"
                              tone="outline"
                              size="sm"
                              className="min-w-28 text-xs"
                              disabled={u.id === user?.id}
                              onClick={() => setDeleting(u)}
                            >
                              {t("delete")}
                            </Button>
                          ) : null}
                        </span>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </RecordTable>
        )}
      </div>

      {drawer ? (
        <UserFormDrawer
          creating={createOpen}
          editing={editing}
          roles={roles}
          pending={createUser.isPending || updateRoles.isPending}
          onClose={() => {
            setCreateOpen(false);
            setEditing(null);
          }}
          onCreate={onCreate}
          onUpdateRoles={onUpdateRoles}
        />
      ) : (
        <>
          <CreateUserDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            roles={roles}
            pending={createUser.isPending}
            onSubmit={onCreate}
          />
          <EditRolesDialog
            user={editing}
            onOpenChange={(open) => !open && setEditing(null)}
            roles={roles}
            pending={updateRoles.isPending}
            onSubmit={onUpdateRoles}
          />
        </>
      )}
      <DeleteUserDialog
        user={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => setDeleting(null)}
      />
    </TopNavShell>
  );
}

/** Users are the System Admin's; anyone else gets a notice, not a 403. */
function UsersGate() {
  const tV2 = useTranslations("adminV2.users");
  const { hasPermission } = useAuth();
  if (hasPermission(PERMISSIONS.USER_READ)) return <UsersTab />;
  return (
    <TopNavShell nav={<AppTopNav app="admin" active="overview" />}>
      <EmptyState icon={Users} title={tV2("noAccess")} />
    </TopNavShell>
  );
}

export default function AdminV2UsersPage() {
  return (
    <RouteGuard home="/admin">
      <React.Suspense>
        <UsersGate />
      </React.Suspense>
    </RouteGuard>
  );
}
