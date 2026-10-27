"use client";

import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@vms/ui";
import { useTranslations } from "next-intl";
import {
  CreateUserForm,
  EditRolesForm,
} from "@/app/[locale]/admin/_components/users/UserDialogs";
import type { UserListItem } from "@/data/users/users.api";

type CreateInput = {
  email: string;
  fullName: string;
  password: string;
  roles: string[];
};

/** `editing` null + `creating` true → create; a user → edit their roles. */
export function UserFormDrawer({
  creating,
  editing,
  roles,
  pending,
  onClose,
  onCreate,
  onUpdateRoles,
}: {
  creating: boolean;
  editing: UserListItem | null;
  roles: string[];
  pending: boolean;
  onClose: () => void;
  onCreate: (input: CreateInput) => void;
  onUpdateRoles: (id: string, roles: string[]) => void;
}) {
  const t = useTranslations("users");
  const tV2 = useTranslations("adminV2.users");
  const open = creating || !!editing;
  if (!open) return null;

  const title = editing
    ? t("editRolesFor", { name: editing.fullName })
    : t("newUser");

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent side="start" className="flex flex-col gap-0 p-0">
        <div className="flex flex-col gap-1 border-b border-border p-5 pe-12">
          <DrawerTitle className="text-xl font-semibold text-fg">
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-sm text-fg-muted">
            {editing ? editing.email : tV2("createSubtitle")}
          </DrawerDescription>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {editing ? (
            <EditRolesForm
              key={editing.id}
              initialRoles={editing.roles}
              roles={roles}
              pending={pending}
              onSubmit={(next) => onUpdateRoles(editing.id, next)}
            />
          ) : (
            <CreateUserForm
              roles={roles}
              pending={pending}
              onSubmit={onCreate}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
