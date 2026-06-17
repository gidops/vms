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
