/**
 * Access token in memory; refresh token persisted so sessions survive reloads.
 * Known trade-off: localStorage is readable by page scripts — moving the refresh
 * token to an httpOnly SameSite cookie set by the backend is the hardening path.
 */
const REFRESH_KEY = "vms.refreshToken";

let accessToken: string | null = null;

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },
  setAccessToken(token: string | null): void {
    accessToken = token;
  },
  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  setRefreshToken(token: string | null): void {
    if (typeof window === "undefined") return;
    if (token) {
      window.localStorage.setItem(REFRESH_KEY, token);
    } else {
      window.localStorage.removeItem(REFRESH_KEY);
    }
  },
  clear(): void {
    accessToken = null;
    this.setRefreshToken(null);
  },
};
