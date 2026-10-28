import type {
  AdminUpdateUserInput,
  UserDetail as ContractUserDetail,
  UserListItem as ContractUserListItem,
} from "@vms/contracts";
import { api } from "@/data/http/client";
import type { Paginated } from "@/data/inbox/inbox.api";
import type { Wire } from "@/data/insights/insights.api";

export type UserListItem = Wire<ContractUserListItem>;
export type UserDetail = Wire<ContractUserDetail>;

export interface UserListParams {
  page: number;
  pageSize: number;
  search?: string;
  role?: string;
  status?: "active" | "inactive";
}

export const usersApi = {
  /** Search, role/status filters and paging all run server-side. */
  list(params: UserListParams): Promise<Paginated<UserListItem>> {
    const qs = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
    });
    if (params.search) qs.set("search", params.search);
    if (params.role) qs.set("role", params.role);
    if (params.status) qs.set("status", params.status);
    return api<Paginated<UserListItem>>(`/users?${qs.toString()}`);
  },
  get(id: string): Promise<UserDetail> {
    return api<UserDetail>(`/users/${id}`);
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
  update(id: string, input: AdminUpdateUserInput): Promise<UserDetail> {
    return api<UserDetail>(`/users/${id}`, { method: "PATCH", body: input });
  },
  setStatus(id: string, isActive: boolean): Promise<UserDetail> {
    return api<UserDetail>(`/users/${id}/status`, {
      method: "PATCH",
      body: { isActive },
    });
  },
  /** Emails the user a single-use set-password link (expires server-side). */
  requestPasswordReset(id: string): Promise<{ expiresAt: string }> {
    return api<{ expiresAt: string }>(`/users/${id}/password-reset`, {
      method: "POST",
    });
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
