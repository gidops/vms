import { tokenStore } from "@/shared/auth/token-store";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Registered by the auth layer: attempts a token refresh on 401. Returning true
// means the original request should be retried with the new access token.
let unauthorizedHandler: (() => Promise<boolean>) | null = null;
export function setUnauthorizedHandler(
  handler: (() => Promise<boolean>) | null,
): void {
  unauthorizedHandler = handler;
}

/**
 * Best-effort current locale for outgoing requests. next-intl persists the
 * active locale in the `NEXT_LOCALE` cookie; we fall back to the first path
 * segment, then to "en". Backend normalizes (en → EN) and defaults to EN.
 */
function currentLocale(): string {
  if (typeof document !== "undefined") {
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("NEXT_LOCALE="));
    if (cookie) return cookie.split("=")[1] ?? "en";
  }
  if (typeof location !== "undefined") {
    const seg = location.pathname.split("/")[1];
    if (seg === "fr" || seg === "ar") return seg;
  }
  return "en";
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  /** Skip attaching the Authorization header (e.g. login/refresh). */
  auth?: boolean;
  _retry?: boolean;
}

/**
 * Single network boundary for the app: injects the access token + a correlation
 * id, normalizes errors to ApiError, and transparently refreshes once on 401.
 */
export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "x-correlation-id": crypto.randomUUID(),
    // Tell the backend which language to render server-side content in (API
    // errors, validation messages, and any notifications it triggers).
    "x-locale": currentLocale(),
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const token = tokenStore.getAccessToken();
  if (token && options.auth !== false) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (
    response.status === 401 &&
    !options._retry &&
    options.auth !== false &&
    unauthorizedHandler
  ) {
    const refreshed = await unauthorizedHandler();
    if (refreshed) return api<T>(path, { ...options, _retry: true });
  }

  const text = await response.text();
  const json: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const title =
      (json as { title?: string } | undefined)?.title ?? response.statusText;
    throw new ApiError(response.status, title, json);
  }

  return json as T;
}

/** Pull `filename="…"` out of a Content-Disposition header. */
export function filenameFromDisposition(
  header: string | null,
  fallback: string,
): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

/**
 * Authenticated file download (CSV / Excel exports). Same auth + one-shot
 * refresh as {@link api}, but resolves to the response body as a Blob and
 * saves it through a temporary object URL.
 */
export async function apiDownload(
  path: string,
  fallbackName: string,
  _retry = false,
): Promise<{ filename: string; size: number }> {
  const headers: Record<string, string> = {
    "x-correlation-id": crypto.randomUUID(),
    "x-locale": currentLocale(),
  };
  const token = tokenStore.getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { headers });
  if (response.status === 401 && !_retry && unauthorizedHandler) {
    const refreshed = await unauthorizedHandler();
    if (refreshed) return apiDownload(path, fallbackName, true);
  }
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    const title =
      (body as { title?: string } | undefined)?.title ?? response.statusText;
    throw new ApiError(response.status, title, body);
  }

  const blob = await response.blob();
  const filename = filenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackName,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { filename, size: blob.size };
}
