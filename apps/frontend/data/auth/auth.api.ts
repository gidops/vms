import { api } from "@/data/http/client";

interface UserPayload {
  id: string;
  email: string;
  fullName: string;
  preferredLocale: string;
  roles: string[];
  activeRole: string | null;
  permissions: string[];
}

/** Matches the backend's auth response (login/signup). */
export interface AuthResult {
  user: UserPayload;
  tokens: { accessToken: string; expiresIn: number; tokenType: string };
  refreshToken: string;
}

/** switch-role re-mints the access token only (no new refresh token). */
export interface SwitchRoleResult {
  user: UserPayload;
  tokens: { accessToken: string; expiresIn: number; tokenType: string };
}

export interface NotificationPrefs {
  newInviteRequest: boolean;
  csoDenied: boolean;
  csoApproved: boolean;
  flaggedVisitor: boolean;
}

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarKey: string | null;
  timezone: string | null;
  assignedDesk: string | null;
  notificationPrefs: NotificationPrefs | null;
  preferredLocale: string;
  roles: string[];
  activeRole: string | null;
  permissions: string[];
  /** Host office/department, when the user receives visitors (STAFF). */
  hostOffice: string | null;
  hostDepartment: string | null;
}

export const authApi = {
  login(email: string, password: string): Promise<AuthResult> {
    return api<AuthResult>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  },
  signup(
    email: string,
    fullName: string,
    password: string,
  ): Promise<AuthResult> {
    return api<AuthResult>("/auth/signup", {
      method: "POST",
      body: { email, fullName, password },
      auth: false,
    });
  },
  signupAvailable(): Promise<{ available: boolean }> {
    return api<{ available: boolean }>("/auth/signup-available", {
      auth: false,
    });
  },
  switchRole(role: string): Promise<SwitchRoleResult> {
    return api<SwitchRoleResult>("/auth/switch-role", {
      method: "POST",
      body: { role },
    });
  },
  refresh(refreshToken: string): Promise<AuthResult> {
    return api<AuthResult>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      auth: false,
    });
  },
  logout(refreshToken: string): Promise<void> {
    return api<void>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
    });
  },
  me(): Promise<MeResponse> {
    return api<MeResponse>("/users/me");
  },
};
