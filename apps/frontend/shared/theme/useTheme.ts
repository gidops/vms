"use client";

import { useSyncExternalStore } from "react";
import {
  readTheme,
  setTheme,
  subscribeTheme,
  type ThemePreference,
} from "./theme";

// The server can't see the device's choice, so it renders the default.
const serverTheme = (): ThemePreference => "light";

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
  return { theme, setTheme };
}
