import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiStream } from "@/data/http/client";
import { staleKeysFor } from "./invalidation";
import { readChanges, useLiveUpdates } from "./useLiveUpdates";

vi.mock("@/data/http/client", () => ({ apiStream: vi.fn() }));

const encoder = new TextEncoder();

/** A stream that delivers `chunks` and then stays open until aborted. */
function sse(chunks: string[], stayOpen = false) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      if (!stayOpen) controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>) {
  const out: string[] = [];
  for await (const type of readChanges(body)) out.push(type);
  return out;
}

afterEach(() => vi.mocked(apiStream).mockReset());

describe("readChanges", () => {
  it("yields change types, skipping heartbeats", async () => {
    const body = sse([
      'event: change\ndata: {"type":"visitor.checked_in"}\n\n',
      "event: ping\ndata: \n\n",
      'event: change\ndata: {"type":"alert.created"}\n\n',
    ]);
    expect(await collect(body)).toEqual([
      "visitor.checked_in",
      "alert.created",
    ]);
  });

  it("joins a message split across network chunks", async () => {
    const body = sse([
      'event: change\ndata: {"type":"vis',
      'it.approved"}\n\n',
    ]);
    expect(await collect(body)).toEqual(["visit.approved"]);
  });
});

describe("staleKeysFor", () => {
  const has = (type: string, key: string) =>
    staleKeysFor(type).some((k) => k[0] === key);

  it("refreshes boards, feeds, counts and card stock on check-in", () => {
    for (const key of ["visits", "inbox", "staff", "insights", "rfid-cards"]) {
      expect(has("visitor.checked_in", key)).toBe(true);
    }
  });

  it("refreshes the host's feed and unread count when a request changes", () => {
    expect(has("visit.approved", "staff")).toBe(true);
    expect(has("visit.approved", "inbox")).toBe(true);
    expect(has("visit.approved", "rfid-cards")).toBe(false);
  });

  it("keeps unrelated domains apart", () => {
    expect(has("user.created", "users")).toBe(true);
    expect(has("user.created", "visits")).toBe(false);
    expect(has("visitor_pass.printed", "visitor-passes")).toBe(true);
  });

  it("always refreshes the audit trail", () => {
    expect(has("desk_qr.rotated", "audit")).toBe(true);
    expect(has("something.new", "audit")).toBe(true);
  });
});

describe("useLiveUpdates", () => {
  function setup(enabled = true) {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useLiveUpdates(enabled), { wrapper });
    return { invalidate, hook };
  }

  it("refetches the queries a pushed change affects, once per burst", async () => {
    vi.mocked(apiStream).mockResolvedValue(
      sse(
        [
          'event: change\ndata: {"type":"visit.approved"}\n\n',
          'event: change\ndata: {"type":"visit.approved"}\n\n',
        ],
        true,
      ),
    );
    const { invalidate, hook } = setup();

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["staff"] }),
    );
    const staffCalls = invalidate.mock.calls.filter(
      ([arg]) => arg?.queryKey?.[0] === "staff",
    );
    expect(staffCalls).toHaveLength(1);
    expect(apiStream).toHaveBeenCalledWith(
      "/live/stream",
      expect.any(AbortSignal),
    );
    hook.unmount();
  });

  it("refetches everything after reconnecting from a dropped connection", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(apiStream)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(sse([], true));
    const { invalidate, hook } = setup();

    await vi.advanceTimersByTimeAsync(2_000);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith());
    hook.unmount();
    vi.useRealTimers();
  });

  it("stays closed while signed out", () => {
    setup(false);
    expect(apiStream).not.toHaveBeenCalled();
  });
});
