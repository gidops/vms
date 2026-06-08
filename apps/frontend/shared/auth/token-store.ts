/**
 * Token storage. Access token lives in memory (cleared on reload); the refresh
 * token is persisted so sessions survive reloads.
 *
 * NOTE: persisting the refresh token in localStorage is a pragmatic interim
 * choice. The hardening path (see plan) is to have the backend set an httpOnly,
 * SameSite cookie for the refresh token so it's not reachable from JS.
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
