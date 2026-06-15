import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "./users.api";

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: () => usersApi.list() });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
