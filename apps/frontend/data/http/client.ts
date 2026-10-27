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

// Set by the auth layer; returns true when the request should be retried with a refreshed token.
let unauthorizedHandler: (() => Promise<boolean>) | null = null;
export function setUnauthorizedHandler(
  handler: (() => Promise<boolean>) | null,
): void {
  unauthorizedHandler = handler;
}

/** Locale from the `NEXT_LOCALE` cookie, else the first path segment, else "en". */
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
    // The backend renders errors and notifications in this language.
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

function filenameFromDisposition(
  header: string | null,
  fallback: string,
): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

/** Authenticated binary GET with the same one-shot refresh as {@link api}. */
export async function apiBlob(
  path: string,
  _retry = false,
): Promise<{ blob: Blob; headers: Headers }> {
  const headers: Record<string, string> = {
    "x-correlation-id": crypto.randomUUID(),
    "x-locale": currentLocale(),
  };
  const token = tokenStore.getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { headers });
  if (response.status === 401 && !_retry && unauthorizedHandler) {
    const refreshed = await unauthorizedHandler();
    if (refreshed) return apiBlob(path, true);
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
  return { blob: await response.blob(), headers: response.headers };
}

/** Saves an {@link apiBlob} download through a temporary object URL. */
export async function apiDownload(
  path: string,
  fallbackName: string,
): Promise<{ filename: string; size: number }> {
  const { blob, headers } = await apiBlob(path);
  const filename = filenameFromDisposition(
    headers.get("Content-Disposition"),
    fallbackName,
  );
  saveBlob(blob, filename);
  return { filename, size: blob.size };
}

/** Hands a Blob to the browser as a download through a short-lived object URL. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
