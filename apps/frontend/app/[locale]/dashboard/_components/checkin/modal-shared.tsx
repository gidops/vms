"use client";

import * as React from "react";

/** Visit-status label as shown in the check-in/out modals (CHECKED_IN → ONSITE). */
export function statusText(status: string): string {
  if (status === "CHECKED_IN") return "ONSITE";
  if (status === "CHECKED_OUT") return "CHECKED OUT";
  return status.replace(/_/g, " ");
}

/** Format an elapsed millisecond span as HH:MM:SS. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(
    Math.floor((total % 3600) / 60),
  )}:${pad(total % 60)}`;
}

export function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success";
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="text-fg-muted">{label}</span>
      <span
        className={
          "text-right font-semibold " +
          (accent === "success" ? "text-success" : "text-fg")
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The tinted left pane of the invited check-in/out modals: the visit QR, its
 * reference code, and a hint. `tone="danger"` is the rose check-out variant.
 */
export function QrPane({
  qrCode,
  code,
  hint,
  tone = "default",
}: {
  qrCode?: string | null;
  code?: string | null;
  hint?: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={
        "flex w-full flex-col items-center justify-center gap-4 p-8 md:w-2/5 " +
        (tone === "danger" ? "bg-danger-subtle/40" : "bg-primary-subtle/40")
      }
    >
      {qrCode ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrCode} alt="Visit QR code" className="size-48" />
      ) : null}
      {code ? (
        <span className="rounded-lg bg-surface px-6 py-3 text-2xl font-bold tracking-[0.3em] text-fg shadow-sm">
          {code}
        </span>
      ) : null}
      {hint ? (
        <p className="max-w-[16rem] text-center text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
