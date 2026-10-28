"use client";

import type { GateVerifySource } from "@vms/contracts";
import { Alert, AlertDescription, Spinner } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { GateResult as GateResultData } from "@/data/gate/gate.api";
import { useGateVerify } from "@/data/gate/queries";
import { ApiError } from "@/data/http/client";
import { GateResult } from "./GateResult";
import { GateScanner } from "./GateScanner";
import { ManualCodeForm } from "./ManualCodeForm";

/** Longest payload sent on; anything longer isn't an invitation QR anyway. */
const MAX_PAYLOAD = 64;

/**
 * Gate kiosk: scan (or type) a pre-invited visitor's code and tell them whether
 * their visit is today. The gate only informs; the VMC handles everything else.
 */
export function GateKiosk({
  token,
  onRevoked,
}: {
  token: string;
  /** The kiosk link was rotated or disabled while the page was open. */
  onRevoked: () => void;
}) {
  const t = useTranslations("gate");
  const verify = useGateVerify(token);
  const [result, setResult] = React.useState<GateResultData | null>(null);
  // Re-mounts the typed-code form so it is empty for the next visitor.
  const [round, setRound] = React.useState(0);

  const check = (code: string, source: GateVerifySource) => {
    if (verify.isPending) return;
    verify.mutate(
      { code: code.trim().slice(0, MAX_PAYLOAD), source },
      {
        onSuccess: setResult,
        onError: (err) => {
          if (err instanceof ApiError && err.status === 404) onRevoked();
        },
      },
    );
  };

  const next = React.useCallback(() => {
    setResult(null);
    verify.reset();
    setRound((r) => r + 1);
  }, [verify]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {result ? (
        <GateResult result={result} onDone={next} />
      ) : (
        <div className="flex flex-col gap-1 text-center md:text-start">
          <h1 className="text-2xl font-semibold text-fg sm:text-3xl">
            {t("heading")}
          </h1>
          <p className="text-fg-muted">{t("subtitle")}</p>
        </div>
      )}

      {verify.isError ? (
        <Alert intent="danger">
          <AlertDescription>
            {verify.error instanceof ApiError
              ? verify.error.message
              : t("error")}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Kept mounted (hidden) under a result so the camera doesn't restart per visitor. */}
      <div
        className={
          result
            ? "hidden"
            : "grid items-start gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
        }
      >
        <div className="relative">
          <GateScanner
            paused={!!result || verify.isPending}
            onCode={(payload) => check(payload, "scan")}
          />
          {verify.isPending ? (
            <div className="absolute inset-x-0 top-0 flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl bg-black/60 text-white">
              <Spinner />
              <span>{t("checking")}</span>
            </div>
          ) : null}
        </div>
        <ManualCodeForm
          key={round}
          busy={verify.isPending}
          onSubmit={(code) => check(code, "manual")}
        />
      </div>
    </div>
  );
}
