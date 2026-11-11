"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiStream } from "@/data/http/client";
import { staleKeysFor } from "./invalidation";

/** A burst of events (a bulk approval) becomes one round of refetches. */
const FLUSH_MS = 250;
const MAX_RETRY_MS = 30_000;

/** Yields the event type of each `change` message in a server-sent event stream. */
export async function* readChanges(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";
      for (const message of messages) {
        const lines = message.split("\n");
        if (!lines.includes("event: change")) continue;
        const data = lines.find((line) => line.startsWith("data: "));
        const type =
          data && (JSON.parse(data.slice(6)) as { type?: unknown }).type;
        if (typeof type === "string") yield type;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      resolve();
    });
  });
}

/**
 * Keeps this browser's screens current with changes other people make: the
 * server pushes the type of each change, and the matching queries refetch.
 * The stream ends every few minutes by design and is reopened straight away;
 * after a dropped connection everything is refetched, since events were missed.
 */
export function useLiveUpdates(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const { signal } = controller;
    const stale = new Map<string, readonly string[]>();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      flushTimer = undefined;
      stale.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
      stale.clear();
    };
    const onChange = (type: string) => {
      for (const key of staleKeysFor(type)) stale.set(key.join("/"), key);
      flushTimer ??= setTimeout(flush, FLUSH_MS);
    };

    void (async () => {
      let failures = 0;
      while (!signal.aborted) {
        try {
          const body = await apiStream("/live/stream", signal);
          if (failures > 0) void queryClient.invalidateQueries();
          failures = 0;
          for await (const type of readChanges(body)) onChange(type);
        } catch {
          if (signal.aborted) return;
          failures += 1;
        }
        if (failures > 0) {
          await pause(Math.min(1000 * 2 ** failures, MAX_RETRY_MS), signal);
        }
      }
    })();

    return () => {
      controller.abort();
      clearTimeout(flushTimer);
    };
  }, [enabled, queryClient]);
}
