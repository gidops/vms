"use client";

import { PERMISSIONS, type OptInItem } from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Input,
  Label,
  Pagination,
  RecordTable,
  SearchInput,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { Download, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import {
  useExportOptIns,
  useOptIns,
  useWithdrawConsent,
} from "@/data/consent/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { formatWatDateTime } from "@/shared/wat";
import { VisitDetailSheet } from "./VisitDetailSheet";

const PAGE_SIZE = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Debounce a fast-changing value (the search box). */
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function SourceVisit({
  item,
  onOpen,
}: {
  item: OptInItem;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("consent");
  if (!item.sourceVisitId) return <span className="text-fg-muted">—</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(item.sourceVisitId!)}
      className="rounded-sm font-semibold tracking-wide text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      {item.sourceReferenceCode ?? t("viewVisit")}
    </button>
  );
}

type WithdrawResult = { kind: "notFound" } | { kind: "error" } | null;

/**
 * "Withdraw consent" → dialog: enter the email, then confirm against a warning
 * banner. Withdrawal is a new consent event: the email leaves the list now,
 * past visit records stay unchanged. `onWithdrawn` reports a success so the
 * page can confirm it after the dialog closes.
 */
export function WithdrawConsentDialog({
  onWithdrawn,
}: {
  onWithdrawn?: (email: string) => void;
}) {
  const t = useTranslations("consent");
  const withdraw = useWithdrawConsent();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [showError, setShowError] = React.useState(false);
  const [result, setResult] = React.useState<WithdrawResult>(null);

  const trimmed = email.trim();
  const valid = EMAIL_RE.test(trimmed);
  const invalid = showError && !valid;

  const reset = () => {
    setEmail("");
    setConfirming(false);
    setShowError(false);
    setResult(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (!valid) {
      setShowError(true);
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    withdraw.mutate(trimmed, {
      onSuccess: (r) => {
        if (r.affected) {
          setOpen(false);
          reset();
          onWithdrawn?.(trimmed);
        } else {
          setConfirming(false);
          setResult({ kind: "notFound" });
        }
      },
      onError: () => {
        setConfirming(false);
        setResult({ kind: "error" });
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (withdraw.isPending) return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button intent="danger" tone="outline">
          {t("withdrawTitle")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("withdrawTitle")}</DialogTitle>
          <DialogDescription>{t("withdrawHelp")}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          {result ? (
            <Alert intent={result.kind === "error" ? "danger" : "neutral"}>
              <AlertDescription>
                {result.kind === "error" ? t("error") : t("notFound")}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="withdraw-email">{t("email")}</Label>
            <Input
              id="withdraw-email"
              type="email"
              autoComplete="off"
              value={email}
              invalid={invalid}
              aria-describedby={invalid ? "withdraw-email-error" : undefined}
              placeholder={t("emailPlaceholder")}
              onChange={(e) => {
                setEmail(e.target.value);
                setConfirming(false);
              }}
            />
            {invalid ? (
              <span id="withdraw-email-error" className="text-xs text-danger">
                {t("invalidEmail")}
              </span>
            ) : null}
          </div>
          {confirming ? (
            <Alert intent="warning">
              <AlertTitle>{t("confirmTitle")}</AlertTitle>
              <AlertDescription>
                {t.rich("confirmBody", {
                  email: trimmed,
                  b: (chunks) => (
                    <b className="font-semibold text-fg">{chunks}</b>
                  ),
                })}
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            {confirming ? (
              <Button
                type="button"
                intent="neutral"
                tone="outline"
                onClick={() => setConfirming(false)}
                disabled={withdraw.isPending}
              >
                {t("cancel")}
              </Button>
            ) : null}
            <Button
              type="submit"
              intent="danger"
              disabled={withdraw.isPending}
              aria-busy={withdraw.isPending || undefined}
            >
              {t("withdraw")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Comms Opt-ins, shared by the admin console (/admin/opt-ins) and the VMC desk
 * (/dashboard/opt-ins): the current opt-in list (latest answer per email wins),
 * a CSV export for holders of consent:export, and consent withdrawal for
 * holders of consent:manage.
 */
export function CommsOptInsScreen() {
  const t = useTranslations("consent");
  const locale = useLocale();
  const { hasPermission } = useAuth();
  const canExport = hasPermission(PERMISSIONS.CONSENT_EXPORT);
  const canManage = hasPermission(PERMISSIONS.CONSENT_MANAGE);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [visitId, setVisitId] = React.useState<string | null>(null);
  const [withdrawn, setWithdrawn] = React.useState<string | null>(null);
  const debounced = useDebounced(search.trim());

  const list = useOptIns({
    page,
    pageSize: PAGE_SIZE,
    search: debounced || undefined,
  });
  const exporter = useExportOptIns();
  const data = list.data;
  const nf = new Intl.NumberFormat(locale);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-primary">{t("title")}</h1>
        <div className="flex flex-wrap gap-3">
          {canManage ? (
            <WithdrawConsentDialog onWithdrawn={setWithdrawn} />
          ) : null}
          {canExport ? (
            <Button
              onClick={() => exporter.mutate()}
              disabled={exporter.isPending}
              aria-busy={exporter.isPending || undefined}
            >
              <Download className="size-4" aria-hidden="true" />
              {t("exportCsv")}
            </Button>
          ) : null}
        </div>
      </div>

      {exporter.isError ? (
        <Alert intent="danger">
          <AlertDescription>{t("exportError")}</AlertDescription>
        </Alert>
      ) : null}
      {withdrawn ? (
        <Alert intent="success" role="status">
          <AlertDescription>{t("done", { email: withdrawn })}</AlertDescription>
        </Alert>
      ) : null}

      <RecordTable
        frameless
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              className="text-xl font-semibold text-primary"
              aria-live="polite"
            >
              {data ? nf.format(data.total) : "—"}{" "}
              <span className="font-normal text-fg-muted">{t("optedIn")}</span>
            </h2>
            <SearchInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              onClear={() => {
                setSearch("");
                setPage(1);
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="sm:w-80"
            />
          </div>
        }
        isEmpty={!!data && data.items.length === 0}
        emptyState={
          <EmptyState
            icon={MailCheck}
            title={debounced ? t("noMatches") : t("empty")}
          />
        }
        pagination={
          data && data.totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={data.totalPages}
              onPageChange={setPage}
            />
          ) : undefined
        }
      >
        {list.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : list.isError && !data ? (
          <Alert intent="danger">
            <AlertDescription>{t("loadError")}</AlertDescription>
          </Alert>
        ) : data ? (
          <>
            <div className="hidden md:block">
              <Table aria-label={t("title")}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.email")}</TableHead>
                    <TableHead>{t("columns.name")}</TableHead>
                    <TableHead>{t("columns.lastAnswered")}</TableHead>
                    <TableHead>{t("columns.sourceVisit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody striped>
                  {data.items.map((item) => (
                    <TableRow key={item.email}>
                      <TableCell className="font-medium">
                        {item.email}
                      </TableCell>
                      <TableCell className="text-fg-muted">
                        {item.fullName ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-fg-muted">
                        {formatWatDateTime(item.consentedAt, locale)}
                      </TableCell>
                      <TableCell>
                        <SourceVisit item={item} onOpen={setVisitId} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="flex flex-col overflow-hidden rounded-lg border border-border md:hidden">
              {data.items.map((item) => (
                <li
                  key={item.email}
                  className="flex flex-col gap-0.5 border-b border-border-subtle px-4 py-3 last:border-b-0"
                >
                  <span className="truncate font-medium text-fg">
                    {item.email}
                  </span>
                  <span className="text-sm text-fg-muted">
                    {[
                      item.fullName,
                      formatWatDateTime(item.consentedAt, locale),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="text-sm">
                    <SourceVisit item={item} onOpen={setVisitId} />
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </RecordTable>

      {visitId ? (
        <VisitDetailSheet
          kind="request"
          id={visitId}
          onClose={() => setVisitId(null)}
        />
      ) : null}
    </div>
  );
}
