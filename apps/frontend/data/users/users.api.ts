import { api } from "@/data/http/client";
import type { Paginated } from "@/data/inbox/inbox.api";

export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
}

export const usersApi = {
  list(): Promise<Paginated<UserListItem>> {
    return api<Paginated<UserListItem>>("/users?pageSize=100");
  },
  listRoles(): Promise<string[]> {
    return api<string[]>("/roles");
  },
  create(input: {
    email: string;
    fullName: string;
    password: string;
    roles: string[];
  }): Promise<{ id: string; email: string; roles: string[] }> {
    return api("/users", { method: "POST", body: input });
  },
  updateRoles(
    id: string,
    roles: string[],
  ): Promise<{ id: string; email: string; roles: string[] }> {
    return api(`/users/${id}/roles`, { method: "PATCH", body: { roles } });
  },
  remove(id: string): Promise<void> {
    return api<void>(`/users/${id}`, { method: "DELETE" });
  },
};
