"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Spinner,
  cn,
} from "@vms/ui";
import { Ban, RefreshCw, ScanLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import {
  useCreateGateKiosk,
  useDisableGateKiosk,
  useEnableGateKiosk,
  useGateKioskImage,
  useGateKioskLink,
  useRotateGateKiosk,
} from "@/data/gate/queries";
import { formatWatDateTime } from "@/shared/wat";

type Confirm = "rotate" | "disable" | null;

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function ConfirmDialog({
  kind,
  pending,
  onConfirm,
  onClose,
}: {
  kind: Confirm;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("gateKiosk");
  const rotate = kind === "rotate";
  return (
    <Dialog
      open={kind !== null}
      onOpenChange={(o) => !o && !pending && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {rotate ? t("confirmRotate.title") : t("confirmDisable.title")}
          </DialogTitle>
          <DialogDescription>
            {rotate ? t("confirmRotate.body") : t("confirmDisable.body")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            intent="neutral"
            tone="outline"
            onClick={onClose}
            disabled={pending}
          >
            {t("cancel")}
          </Button>
          <Button
            intent={rotate ? "primary" : "danger"}
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {rotate ? t("confirmRotate.confirm") : t("confirmDisable.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * System Admin: the gate kiosk link. The device opens it once (copy the link,
 * or scan the QR with the device camera); rotating or disabling it cuts off
 * every device using the old link.
 */
export function GateKioskTab() {
  const t = useTranslations("gateKiosk");
  const locale = useLocale();
  const link = useGateKioskLink();
  const view = link.data ?? null;
  const image = useGateKioskImage(view?.url);
  const create = useCreateGateKiosk();
  const rotate = useRotateGateKiosk();
  const disable = useDisableGateKiosk();
  const enable = useEnableGateKiosk();
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [copied, setCopied] = React.useState(false);

  const failed = rotate.isError
    ? t("errors.rotate")
    : disable.isError
      ? t("errors.disable")
      : enable.isError
        ? t("errors.enable")
        : null;

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  if (link.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (link.isError) {
    return (
      <Alert intent="danger">
        <AlertTitle>{t("loadError.title")}</AlertTitle>
        <AlertDescription>{t("loadError.body")}</AlertDescription>
        <div className="mt-2">
          <Button
            intent="neutral"
            tone="outline"
            size="sm"
            onClick={() => void link.refetch()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("retry")}
          </Button>
        </div>
      </Alert>
    );
  }

  if (!view) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          icon={ScanLine}
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            <Button
              intent="primary"
              onClick={() => create.mutate()}
              disabled={create.isPending}
              aria-busy={create.isPending || undefined}
            >
              {t("empty.create")}
            </Button>
          }
        />
        {create.isError ? (
          <Alert intent="danger">
            <AlertDescription>
              {errorText(create.error, t("errors.create"))}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  }

  const active = view.isActive;
  return (
    <>
      <Card
        role="region"
        aria-label={t("title")}
        className="flex flex-col overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold text-fg">{t("title")}</h2>
          <Badge intent={active ? "success" : "neutral"} tone="soft" dot>
            {active ? t("status.active") : t("status.disabled")}
          </Badge>
        </div>

        <div className="grid gap-6 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-5">
          {/* Phones centre the code so it's easy to show or scan. */}
          <div className="flex flex-col items-center gap-2.5 sm:items-start">
            <div className="relative grid size-52 max-w-full place-items-center bg-surface">
              {image.data ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.data}
                  alt={t("qrAlt")}
                  className={cn("size-full", !active && "opacity-15")}
                />
              ) : image.isError ? (
                <span className="text-center text-sm text-danger">
                  {t("errors.image")}
                </span>
              ) : (
                <Spinner />
              )}
              {!active ? (
                <span className="absolute inset-4 grid place-items-center text-center text-sm font-semibold text-fg-muted">
                  {t("disabledOverlay")}
                </span>
              ) : null}
            </div>
            <div className="flex max-w-52 items-center gap-1.5 text-xs text-fg-muted">
              <code className="min-w-0 truncate font-mono" dir="ltr">
                {view.url}
              </code>
              <Button
                size="sm"
                intent="primary"
                tone="ghost"
                className="shrink-0"
                onClick={() => void copyLink(view.url)}
              >
                {copied ? t("copied") : t("copyLink")}
              </Button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <ol className="flex max-w-prose list-decimal flex-col gap-1.5 ps-5 text-sm text-fg">
              <li>{t("setup.step1")}</li>
              <li>{t("setup.step2")}</li>
              <li>{t("setup.step3")}</li>
            </ol>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-fg-muted">{t("lastScan")}</dt>
              <dd className="font-medium text-fg">
                {view.lastScanAt
                  ? formatWatDateTime(view.lastScanAt, locale)
                  : t("noScans")}
              </dd>
              <dt className="text-fg-muted">{t("linkSince")}</dt>
              <dd className="font-medium text-fg">
                {formatWatDateTime(view.tokenRotatedAt, locale)}
              </dd>
              {!active && view.disabledAt ? (
                <>
                  <dt className="text-fg-muted">{t("disabledSince")}</dt>
                  <dd className="font-medium text-fg">
                    {formatWatDateTime(view.disabledAt, locale)}
                  </dd>
                </>
              ) : null}
              <dt className="text-fg-muted">{t("created")}</dt>
              <dd className="font-medium text-fg">
                {view.createdByName
                  ? t("createdBy", {
                      time: formatWatDateTime(view.createdAt, locale),
                      name: view.createdByName,
                    })
                  : formatWatDateTime(view.createdAt, locale)}
              </dd>
            </dl>

            {failed ? (
              <Alert intent="danger">
                <AlertDescription>{failed}</AlertDescription>
              </Alert>
            ) : null}

            {/* Phones stack the actions full width for easy tapping. */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              {active ? null : (
                <Button
                  intent="primary"
                  onClick={() => enable.mutate()}
                  disabled={enable.isPending}
                  aria-busy={enable.isPending || undefined}
                >
                  {t("enable")}
                </Button>
              )}
              <Button
                intent="neutral"
                tone="outline"
                onClick={() => setConfirm("rotate")}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t("rotate")}
              </Button>
              {active ? (
                <Button
                  intent="danger"
                  tone="outline"
                  onClick={() => setConfirm("disable")}
                >
                  <Ban className="size-4" aria-hidden="true" />
                  {t("disable")}
                </Button>
              ) : null}
            </div>
            <p className="max-w-prose text-sm text-fg-muted">
              {active ? t("rotateHelp") : t("enableHelp")}
            </p>
          </div>
        </div>
      </Card>
      <ConfirmDialog
        kind={confirm}
        pending={rotate.isPending || disable.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          (confirm === "rotate" ? rotate : disable).mutate(undefined, {
            onSettled: () => setConfirm(null),
          })
        }
      />
    </>
  );
}
