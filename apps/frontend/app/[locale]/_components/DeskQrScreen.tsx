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
  Input,
  Label,
  Spinner,
  cn,
} from "@vms/ui";
import { Ban, Download, Printer, QrCode, RefreshCw } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { createPortal } from "react-dom";
import { deskQrApi } from "@/data/desk-qr/desk-qr.api";
import {
  useDeskQr,
  useDeskQrAction,
  useDeskQrImage,
  useDownloadDeskQr,
} from "@/data/desk-qr/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { formatWatDateTime, formatWatTime } from "@/shared/wat";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Confirm = "rotate" | "disable" | null;

/** Where verification codes go: asked when creating, and from "Change". */
function CodeEmailDialog({
  open,
  initial,
  title,
  submitLabel,
  pending,
  error,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  initial: string;
  title: string;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (email: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("deskQr");
  const [email, setEmail] = React.useState(initial);
  const [touched, setTouched] = React.useState(false);
  const invalid = touched && !EMAIL_RE.test(email.trim());
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("codeEmail.help")}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (EMAIL_RE.test(email.trim())) onSubmit(email.trim());
          }}
        >
          {error ? (
            <Alert intent="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="desk-qr-code-email">{t("codeEmail.label")}</Label>
            <Input
              id="desk-qr-code-email"
              type="email"
              value={email}
              invalid={invalid}
              aria-describedby={
                invalid ? "desk-qr-code-email-error" : undefined
              }
              onChange={(e) => setEmail(e.target.value)}
            />
            {invalid ? (
              <span
                id="desk-qr-code-email-error"
                className="text-xs text-danger"
              >
                {t("codeEmail.invalid")}
              </span>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              intent="neutral"
              tone="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** New QR / Disable confirmation (the staff/VMC dialog: header, body, footer). */
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

const subscribeNoop = () => () => {};

/**
 * The A4 poster, portalled to <body> so the print stylesheet can hide all app
 * chrome (same approach as the Evacuation Roll's warden print). V1 wording.
 */
function PrintPoster({ qr, image }: { qr: DeskQrView; image: string }) {
  const t = useTranslations("deskQr.poster");
  const format = useFormatter();
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <div className="deskqr-print-root" aria-hidden="true">
      <div className="deskqr-poster">
        <div className="deskqr-poster-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/afreximbank.svg" alt="" />
          <span>{t("brand")}</span>
        </div>
        <h1>{t("title")}</h1>
        <p className="deskqr-poster-sub">{t("subtitle")}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="deskqr-poster-qr" src={image} alt="" />
        <p>{t("then")}</p>
        <p>{t("code")}</p>
        <p className="deskqr-poster-langs">English · Français · العربية</p>
        <p className="deskqr-poster-foot">
          {t("footer", {
            date: format.dateTime(new Date(qr.tokenRotatedAt), {
              dateStyle: "medium",
            }),
          })}
        </p>
      </div>
    </div>,
    document.body,
  );
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * The VMC desk QR, managed by the System Admin from the admin console
 * (/admin/v2/desk-qr). One card: the QR and its link, scans today, where
 * verification codes are emailed, Print / Download, New QR and Disable/Enable.
 * Holders of issuer:read see it; only issuer:manage holders get the buttons.
 */
export function DeskQrScreen({
  headingLevel = 1,
}: { headingLevel?: 1 | 2 } = {}) {
  // Under another page's h1 (another page) the title steps down a level.
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
  const create = useDeskQrAction((codeEmail: string) =>
    deskQrApi.create({ codeEmail }),
  );
  const update = useDeskQrAction((codeEmail: string) =>
    deskQrApi.update({ codeEmail }),
  );
  const rotate = useDeskQrAction(() => deskQrApi.rotate());
  const disable = useDeskQrAction(() => deskQrApi.disable());
  const enable = useDeskQrAction(() => deskQrApi.enable());
  const [emailDialog, setEmailDialog] = React.useState<
    "create" | "change" | null
  >(null);
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

  // Staff/VMC page header: title with the page's actions on the same row.
  const header = (actions?: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Heading className={`${headingSize} font-semibold text-primary`}>
        {t("title")}
      </Heading>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );

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
        <EmptyState
          icon={QrCode}
          title={t("empty.title")}
          description={canManage ? t("empty.body") : t("empty.readOnly")}
          action={
            canManage ? (
              <Button intent="primary" onClick={() => setEmailDialog("create")}>
                {t("empty.create")}
              </Button>
            ) : null
          }
        />
        {emailDialog === "create" ? (
          <CodeEmailDialog
            open
            initial=""
            title={t("codeEmail.createTitle")}
            submitLabel={t("empty.create")}
            pending={create.isPending}
            error={
              create.isError
                ? errorText(create.error, t("errors.create"))
                : null
            }
            onSubmit={(email) =>
              create.mutate(email, { onSuccess: () => setEmailDialog(null) })
            }
            onOpenChange={(o) => !o && setEmailDialog(null)}
          />
        ) : null}
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
            onClick={() => download.mutate()}
            disabled={download.isPending || !active}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <Badge intent={active ? "success" : "neutral"} tone="soft" dot>
            {active ? t("status.active") : t("status.disabled")}
          </Badge>
          <Badge intent="neutral" tone="soft">
            {t("walkInBadge")}
          </Badge>
        </div>

        <div className="grid gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex flex-col gap-2.5">
            <div className="relative grid size-52 max-w-full place-items-center rounded-xl border border-border bg-surface p-4">
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
              <div className="flex flex-wrap gap-2.5">
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

        <div className="flex flex-col gap-2 border-t border-border bg-surface-muted px-5 py-4">
          <h3 className="text-base font-semibold text-fg">
            {t("codes.title")}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-fg-muted">{t("codes.emailedTo")}</span>
            <span className="font-medium text-fg" dir="ltr">
              {view.codeEmail}
            </span>
            {canManage ? (
              <Button
                size="sm"
                intent="primary"
                tone="ghost"
                onClick={() => setEmailDialog("change")}
              >
                {t("codes.change")}
              </Button>
            ) : null}
          </div>
          <p className="max-w-prose text-sm text-fg-muted">{t("codes.help")}</p>
        </div>
      </Card>

      {emailDialog === "change" ? (
        <CodeEmailDialog
          open
          initial={view.codeEmail}
          title={t("codeEmail.changeTitle")}
          submitLabel={t("codeEmail.save")}
          pending={update.isPending}
          error={
            update.isError ? errorText(update.error, t("errors.update")) : null
          }
          onSubmit={(email) =>
            update.mutate(email, { onSuccess: () => setEmailDialog(null) })
          }
          onOpenChange={(o) => !o && setEmailDialog(null)}
        />
      ) : null}
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
        <PrintPoster qr={view} image={image.data} />
      ) : null}
    </div>
  );
}
