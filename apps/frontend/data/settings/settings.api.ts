import { api } from "@/data/http/client";
import type { MeResponse, NotificationPrefs } from "@/data/auth/auth.api";

export interface UpdateMeInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  preferredLocale?: "EN" | "FR" | "AR";
  timezone?: string | null;
  assignedDesk?: string | null;
  notificationPrefs?: Partial<NotificationPrefs>;
}

export interface LoginActivityItem {
  id: string;
  os: string;
  browser: string;
  location: string | null;
  lastSeenAt: string;
  current: boolean;
}

type ImageContentType = "image/jpeg" | "image/png" | "image/webp";

export const settingsApi = {
  updateMe(input: UpdateMeInput): Promise<MeResponse> {
    return api<MeResponse>("/users/me", { method: "PATCH", body: input });
  },
  presignAvatar(contentType: ImageContentType): Promise<{
    uploadUrl: string;
    key: string;
  }> {
    return api("/users/me/avatar/presign", {
      method: "POST",
      body: { contentType },
    });
  },
  setAvatar(avatarKey: string): Promise<MeResponse> {
    return api<MeResponse>("/users/me/avatar", {
      method: "PUT",
      body: { avatarKey },
    });
  },
  sessions(): Promise<LoginActivityItem[]> {
    return api<LoginActivityItem[]>("/users/me/sessions");
  },
  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return api<void>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  },
  /**
   * Full avatar upload: presign → PUT the file directly to S3 (NOT through the
   * api() client) → persist the key. Returns the refreshed profile.
   */
  async uploadAvatar(file: File): Promise<MeResponse> {
    const contentType = file.type as ImageContentType;
    const { uploadUrl, key } = await this.presignAvatar(contentType);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!res.ok) throw new Error("Upload failed");
    return this.setAvatar(key);
  },
};
