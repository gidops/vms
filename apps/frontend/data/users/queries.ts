import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi, type UserListParams } from "./users.api";

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: ["users", params],
    queryFn: () => usersApi.list(params),
    // Keep the previous page on screen while the next one loads.
    placeholderData: (prev) => prev,
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => usersApi.get(id as string),
    enabled: !!id,
  });
}

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => usersApi.listRoles() });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      fullName: string;
      password: string;
      roles: string[];
    }) => usersApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) =>
      usersApi.updateRoles(id, roles),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["user", id] });
    },
  });
}

export function useAdminUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { firstName?: string; lastName?: string; phone?: string | null };
    }) => usersApi.update(id, input),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["user", id] });
    },
  });
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.setStatus(id, isActive),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["user", id] });
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (id: string) => usersApi.requestPasswordReset(id),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
