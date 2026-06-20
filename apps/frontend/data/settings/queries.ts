import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/shared/auth/AuthContext";
import { settingsApi, type UpdateMeInput } from "./settings.api";

export function useSessions() {
  return useQuery({
    queryKey: ["me", "sessions"],
    queryFn: () => settingsApi.sessions(),
  });
}

export function useUpdateMe() {
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: (input: UpdateMeInput) => settingsApi.updateMe(input),
    onSuccess: () => refreshUser(),
  });
}

export function useUploadAvatar() {
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: (file: File) => settingsApi.uploadAvatar(file),
    onSuccess: () => refreshUser(),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      settingsApi.changePassword(input.currentPassword, input.newPassword),
  });
}
