import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStore } from "@/shared/auth/token-store";
import { api, apiBlob, ApiError, setUnauthorizedHandler } from "./client";

const fetchMock = vi.fn();

function reply(status: number, body?: unknown, headers?: HeadersInit) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

function sentHeaders(call = 0): Record<string, string> {
  return fetchMock.mock.calls[call][1].headers as Record<string, string>;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  tokenStore.setAccessToken("access-1");
  document.cookie = "NEXT_LOCALE=; max-age=0";
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
  tokenStore.setAccessToken(null);
});

describe("api", () => {
  it("sends the bearer token, a correlation id and the locale", async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));

    await expect(api("/visits")).resolves.toEqual({ ok: true });

    const headers = sentHeaders();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/visits$/);
    expect(headers.Authorization).toBe("Bearer access-1");
    expect(headers["x-correlation-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers["x-locale"]).toBe("en");
  });

  it("uses the locale cookie when present", async () => {
    document.cookie = "NEXT_LOCALE=fr";
    fetchMock.mockResolvedValue(reply(200, {}));
    await api("/visits");
    expect(sentHeaders()["x-locale"]).toBe("fr");
  });

  it("serialises a JSON body and leaves the token off public calls", async () => {
    fetchMock.mockResolvedValue(reply(200, {}));

    await api("/auth/login", {
      method: "POST",
      body: { email: "a@b.c" },
      auth: false,
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"email":"a@b.c"}');
    expect(sentHeaders()["Content-Type"]).toBe("application/json");
    expect(sentHeaders().Authorization).toBeUndefined();
  });

  it("returns undefined for an empty success body", async () => {
    fetchMock.mockResolvedValue(reply(204));
    await expect(api("/inbox/seen", { method: "POST" })).resolves.toBe(
      undefined,
    );
  });

  it("turns error responses into ApiError with the server's title", async () => {
    fetchMock.mockResolvedValue(reply(422, { title: "Invalid email" }));

    const error = await api("/users").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      message: "Invalid email",
      body: { title: "Invalid email" },
    });
  });

  it("refreshes once on 401 and retries the request", async () => {
    const refresh = vi.fn(async () => {
      tokenStore.setAccessToken("access-2");
      return true;
    });
    setUnauthorizedHandler(refresh);
    fetchMock
      .mockResolvedValueOnce(reply(401, { title: "Expired" }))
      .mockResolvedValueOnce(reply(200, { id: "v1" }));

    await expect(api("/visits/v1")).resolves.toEqual({ id: "v1" });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sentHeaders(1).Authorization).toBe("Bearer access-2");
  });

  it("gives up after one retry and when the refresh fails", async () => {
    setUnauthorizedHandler(vi.fn(async () => true));
    fetchMock.mockImplementation(async () => reply(401, { title: "Expired" }));
    await expect(api("/visits")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    setUnauthorizedHandler(vi.fn(async () => false));
    await expect(api("/visits")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("apiBlob", () => {
  it("returns the blob and headers of a download", async () => {
    fetchMock.mockResolvedValue(
      new Response("csv-data", {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="x.csv"' },
      }),
    );

    const { blob, headers } = await apiBlob("/consent/opt-ins.csv");

    expect(await blob.text()).toBe("csv-data");
    expect(headers.get("Content-Disposition")).toContain("x.csv");
    expect(sentHeaders().Authorization).toBe("Bearer access-1");
  });

  it("raises ApiError even when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("oops", { status: 500, statusText: "Server Error" }),
    );
    await expect(apiBlob("/export")).rejects.toMatchObject({
      status: 500,
      message: "Server Error",
    });
  });
});
