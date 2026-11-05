"use client";

import { Alert, AlertDescription, Spinner } from "@vms/ui";
import { useTranslations } from "next-intl";
import type QrScannerType from "qr-scanner";
import * as React from "react";

type CameraState = "starting" | "running" | "denied" | "unavailable";

/** A burst of identical decodes (the QR stays in frame) counts as one scan. */
const REPEAT_WINDOW_MS = 2_500;

/**
 * Rear-camera QR viewfinder. Reports each decoded payload once; the parent
 * pauses it while a code is being checked or a result is on screen. When the
 * camera can't run it explains why, and the typed-code form takes over.
 */
export function GateScanner({
  paused,
  onCode,
}: {
  paused: boolean;
  onCode: (payload: string) => void;
}) {
  const t = useTranslations("gate.scanner");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const scannerRef = React.useRef<QrScannerType | null>(null);
  const onCodeRef = React.useRef(onCode);
  const pausedRef = React.useRef(paused);
  const lastRef = React.useRef<{ data: string; at: number } | null>(null);
  // Browsers only expose the camera on HTTPS (or localhost).
  const [secure] = React.useState(
    () => typeof window === "undefined" || window.isSecureContext,
  );
  const [state, setState] = React.useState<CameraState>("starting");

  React.useEffect(() => {
    onCodeRef.current = onCode;
    pausedRef.current = paused;
  });

  React.useEffect(() => {
    if (!secure || !videoRef.current) return;
    const video = videoRef.current;
    let cancelled = false;

    void (async () => {
      const { default: QrScanner } = await import("qr-scanner");
      if (cancelled) return;
      const scanner = new QrScanner(
        video,
        ({ data }) => {
          const now = Date.now();
          const last = lastRef.current;
          if (pausedRef.current || !data) return;
          if (last && last.data === data && now - last.at < REPEAT_WINDOW_MS)
            return;
          lastRef.current = { data, at: now };
          onCodeRef.current(data);
        },
        {
          preferredCamera: "environment",
          maxScansPerSecond: 5,
          returnDetailedScanResult: true,
        },
      );
      scannerRef.current = scanner;
      try {
        await scanner.start();
        if (!cancelled) setState("running");
      } catch (err) {
        if (cancelled) return;
        setState(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "denied"
            : "unavailable",
        );
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [secure]);

  // Freeze the camera while a code is checked or a result is shown.
  React.useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner || state !== "running") return;
    if (paused) void scanner.pause();
    else {
      lastRef.current = null;
      void scanner.start();
    }
  }, [paused, state]);

  const problem = !secure
    ? t("insecure")
    : state === "denied" || state === "unavailable"
      ? t(state)
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label={t("label")}
          className="size-full object-cover"
        />
        {secure && state === "running" ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-[14%] rounded-2xl border-4 border-white/85 shadow-[0_0_0_100vmax_rgb(0_0_0/0.35)]"
          />
        ) : null}
        {secure && state === "starting" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Spinner />
            <span className="text-sm">{t("starting")}</span>
          </div>
        ) : null}
      </div>
      {problem ? (
        <Alert intent="warning">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : (
        <p className="text-center text-sm text-fg-muted">{t("hint")}</p>
      )}
    </div>
  );
}
