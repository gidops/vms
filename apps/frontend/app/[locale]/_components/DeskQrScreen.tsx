"use client";

import { PERMISSIONS, type DeskQrView } from "@vms/contracts";
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
import { Ban, Download, Printer, QrCode, RefreshCw } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import * as React from "react";
import {
  useDeskQr,
  useCreateDeskQr,
  useDisableDeskQr,
  useEnableDeskQr,
  useRotateDeskQr,
  useDeskQrImage,
  useDownloadDeskQr,
} from "@/data/desk-qr/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { formatWatDateTime, formatWatTime } from "@/shared/wat";
import { DeskQrPoster } from "./DeskQrPoster";

type Confirm = "rotate" | "disable" | null;

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
  const t = useTranslations("deskQr");
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
            {rotate
              ? t.rich("confirmRotate.body", {
                  b: (chunks) => (
                    <b className="font-semibold text-fg">{chunks}</b>
                  ),
                })
              : t("confirmDisable.body")}
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

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Holders of issuer:read see the desk QR; only issuer:manage holders get the actions. */
export function DeskQrScreen({
  headingLevel = 1,
  showHeading = true,
}: {
  headingLevel?: 1 | 2;
  /** Off where the host already names the screen (the Operations tab). */
  showHeading?: boolean;
} = {}) {
  // Under another page's h1 the title steps down a level.
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const headingSize = headingLevel === 2 ? "text-2xl" : "text-3xl";
  const t = useTranslations("deskQr");
  const format = useFormatter();
  const locale = useLocale();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.ISSUER_MANAGE);
  const qr = useDeskQr();
  const view = qr.data ?? null;
  const image = useDeskQrImage(view?.url);
  const download = useDownloadDeskQr();
  const create = useCreateDeskQr();
  const rotate = useRotateDeskQr();
  const disable = useDisableDeskQr();
  const enable = useEnableDeskQr();
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [copied, setCopied] = React.useState(false);

  const actionError = [rotate, disable, enable, download].find(
    (m) => m.isError,
  );
  const failed =
    actionError === rotate
      ? t("errors.rotate")
      : actionError === disable
        ? t("errors.disable")
        : actionError === enable
          ? t("errors.enable")
          : actionError === download
            ? t("errors.download")
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

  // Without the title (Operations tab) the actions sit on the end side alone.
  const header = (actions?: React.ReactNode) =>
    showHeading || actions ? (
      <div
        className={cn(
          "flex flex-wrap items-center gap-3",
          showHeading ? "justify-between" : "justify-end",
        )}
      >
        {showHeading ? (
          <Heading className={`${headingSize} font-semibold text-primary`}>
            {t("title")}
          </Heading>
        ) : null}
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    ) : null;

  if (qr.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </div>
    );
  }

  if (qr.isError) {
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <Alert intent="danger">
          <AlertTitle>{t("loadError.title")}</AlertTitle>
          <AlertDescription>{t("loadError.body")}</AlertDescription>
          <div className="mt-2">
            <Button
              intent="neutral"
              tone="outline"
              size="sm"
              onClick={() => void qr.refetch()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {t("retry")}
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex flex-col gap-6">
        {header()}
        {create.isError ? (
          <Alert intent="danger">
            <AlertDescription>
              {errorText(create.error, t("errors.create"))}
            </AlertDescription>
          </Alert>
        ) : null}
        <EmptyState
          icon={QrCode}
          title={t("empty.title")}
          description={canManage ? t("empty.body") : t("empty.readOnly")}
          action={
            canManage ? (
              <Button
                intent="primary"
                onClick={() => create.mutate(undefined)}
                disabled={create.isPending}
                aria-busy={create.isPending || undefined}
              >
                {t("empty.create")}
              </Button>
            ) : null
          }
        />
      </div>
    );
  }

  const active = view.isActive;
  return (
    <div className="flex flex-col gap-6">
      {header(
        <>
          <Button
            intent="neutral"
            tone="outline"
            onClick={() => image.blob && download.mutate(image.blob)}
            disabled={download.isPending || !active || !image.blob}
            aria-busy={download.isPending || undefined}
          >
            <Download className="size-4" aria-hidden="true" />
            {t("downloadPng")}
          </Button>
          <Button
            onClick={() => window.print()}
            disabled={!image.data || !active}
          >
            <Printer className="size-4" aria-hidden="true" />
            {t("print")}
          </Button>
        </>,
      )}
      <Card
        role="region"
        aria-label={t("title")}
        className="flex flex-col overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <Badge intent={active ? "success" : "neutral"} tone="soft" dot>
            {active ? t("status.active") : t("status.disabled")}
          </Badge>
          <Badge intent="neutral" tone="soft">
            {t("walkInBadge")}
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
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-fg-muted">
                {t("scansToday")}
              </span>
              <span className="text-4xl font-bold tabular-nums text-fg">
                {format.number(view.scansToday)}
              </span>
              <span className="text-sm text-fg-muted">
                {!active && view.disabledAt
                  ? t("disabledAt", {
                      time: formatWatDateTime(view.disabledAt, locale),
                    })
                  : view.lastScanAt
                    ? t("lastScan", {
                        time: formatWatTime(view.lastScanAt, locale),
                      })
                    : t("noScans")}
              </span>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-fg-muted">{t("created")}</dt>
              <dd className="font-medium text-fg">
                {view.createdByName
                  ? t("createdBy", {
                      time: formatWatDateTime(view.createdAt, locale),
                      name: view.createdByName,
                    })
                  : formatWatDateTime(view.createdAt, locale)}
              </dd>
              <dt className="text-fg-muted">{t("visitsItCreates")}</dt>
              <dd className="font-medium text-fg">
                {t("visitsItCreatesValue")}
              </dd>
            </dl>

            {failed ? (
              <Alert intent="danger">
                <AlertDescription>{failed}</AlertDescription>
              </Alert>
            ) : null}

            {canManage ? (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                {active ? null : (
                  <Button
                    intent="primary"
                    onClick={() => enable.mutate(undefined)}
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
            ) : null}
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
      {image.data && active ? (
        <DeskQrPoster qr={view} image={image.data} />
      ) : null}
    </div>
  );
}
