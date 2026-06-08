"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AuthResult,
  authApi,
  type MeResponse,
} from "@/data/auth/auth.api";
import { setUnauthorizedHandler } from "@/data/http/client";
import { tokenStore } from "./token-store";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: MeResponse | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const applyTokens = useCallback((result: AuthResult) => {
    tokenStore.setAccessToken(result.tokens.accessToken);
    tokenStore.setRefreshToken(result.refreshToken);
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  // Silent refresh used both on 401 (via the http client) and at bootstrap.
  const tryRefresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) return false;
    try {
      applyTokens(await authApi.refresh(refreshToken));
      return true;
    } catch {
      clearSession();
      return false;
    }
  }, [applyTokens, clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(tryRefresh);
    return () => setUnauthorizedHandler(null);
  }, [tryRefresh]);

  // On load, restore a session from the persisted refresh token (if any).
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!tokenStore.getRefreshToken()) {
        if (active) setStatus("unauthenticated");
        return;
      }
      const refreshed = await tryRefresh();
      if (!active) return;
      if (!refreshed) {
        setStatus("unauthenticated");
        return;
      }
      try {
        const profile = await authApi.me();
        if (!active) return;
        setUser(profile);
        setStatus("authenticated");
      } catch {
        if (active) clearSession();
      }
    })();
    return () => {
      active = false;
    };
  }, [tryRefresh, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      applyTokens(await authApi.login(email, password));
      const profile = await authApi.me();
      setUser(profile);
      setStatus("authenticated");
    },
    [applyTokens],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // best-effort; clear locally regardless
    }
    clearSession();
  }, [clearSession]);

  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, hasPermission }),
    [user, status, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
