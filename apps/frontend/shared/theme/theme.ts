/**
 * The colour theme, remembered per device. Light is the default; "system"
 * follows the OS. The resolved theme is written to `<html data-theme>`, which
 * the token layer (`@vms/tokens`) keys every semantic colour off.
 */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "light",
  "dark",
  "system",
];

const KEY = "vms.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function isPreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function readTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(KEY);
    return isPreference(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference = readTheme()): void {
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

export function setTheme(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(KEY, preference);
  } catch {
    // Unsaved, but still applied for this page.
  }
  applyTheme(preference);
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Keeps `<html>` in step with the OS (in system mode) and with other tabs. */
export function watchTheme(): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const onSystemChange = () => applyTheme();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    applyTheme();
    listeners.forEach((listener) => listener());
  };
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  return () => {
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Inlined in <head> so the saved theme is set before first paint. */
export const themeScript = `(function(){try{var p=localStorage.getItem("${KEY}");var t=p==="dark"||(p==="system"&&matchMedia("${DARK_QUERY}").matches)?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t}catch(e){}})()`;
