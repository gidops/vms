/**
 * The gate kiosk link's token, remembered on the device so it can simply open
 * `/gate`. Storage can be unavailable (private mode, cleared site data), so
 * every access is guarded and callers fall back to the token in the URL.
 */
const KEY = "vms.gateKioskToken";

export function readKioskToken(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** True when the token was stored and can be read back. */
export function rememberKioskToken(token: string): boolean {
  try {
    window.localStorage.setItem(KEY, token);
    return window.localStorage.getItem(KEY) === token;
  } catch {
    return false;
  }
}

export function forgetKioskToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up.
  }
}
