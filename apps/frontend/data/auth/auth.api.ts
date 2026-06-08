import { api } from "@/data/http/client";

/** Matches the backend's auth response (LoginResponse + refreshToken). */
export interface AuthResult {
  user: {
    id: string;
    email: string;
    fullName: string;
    preferredLocale: string;
    roles: string[];
  };
  tokens: { accessToken: string; expiresIn: number; tokenType: string };
  refreshToken: string;
}

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  preferredLocale: string;
  roles: string[];
  permissions: string[];
}

export const authApi = {
  login(email: string, password: string): Promise<AuthResult> {
    return api<AuthResult>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
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
