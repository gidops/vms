"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLiveUpdates } from "@/data/live/useLiveUpdates";
import { AuthProvider, useAuth } from "@/shared/auth/AuthContext";
import { watchTheme } from "@/shared/theme/theme";

/** Pushed changes from other users, while someone is signed in. */
function LiveUpdates() {
  useLiveUpdates(useAuth().status === "authenticated");
  return null;
}

/** Client-side providers: TanStack Query (server-state) + auth, live updates and theme sync. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => watchTheme(), []);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LiveUpdates />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
