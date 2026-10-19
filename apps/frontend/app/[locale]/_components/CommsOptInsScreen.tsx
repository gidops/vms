"use client";

import { PERMISSIONS, type OptInItem } from "@vms/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Label,
  Pagination,
  SearchInput,
  Spinner,
} from "@vms/ui";
import { AlertTriangle, Download } from "lucide-react";
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
      className="font-semibold tracking-wide text-primary hover:underline"
    >
      {item.sourceReferenceCode ?? t("viewVisit")}
    </button>
  );
}

/**
 * Withdraw-consent form + its confirm dialog. Withdrawal is a new consent
 * event: the email leaves the list now, past visit records stay unchanged.
 */
export function WithdrawConsentCard() {
  const t = useTranslations("consent");
  const withdraw = useWithdrawConsent();
  const [email, setEmail] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [showError, setShowError] = React.useState(false);
  const [result, setResult] = React.useState<
    { kind: "done" | "notFound"; email: string } | { kind: "error" } | null
  >(null);

  const trimmed = email.trim();
  const valid = EMAIL_RE.test(trimmed);

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (!valid) {
      setShowError(true);
      return;
    }
    setShowError(false);
    setConfirming(true);
  };

  const confirm = () => {
    withdraw.mutate(trimmed, {
      onSuccess: (r) => {
        setResult({ kind: r.affected ? "done" : "notFound", email: trimmed });
        if (r.affected) setEmail("");
        setConfirming(false);
      },
      onError: () => {
        setResult({ kind: "error" });
        setConfirming(false);
      },
    });
  };

  return (
    <section
      aria-labelledby="withdraw-consent-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="withdraw-consent-title"
          className="text-lg font-semibold text-fg"
        >
          {t("withdrawTitle")}
        </h2>
        <p className="text-sm text-fg-muted">{t("withdrawHelp")}</p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={ask} noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="withdraw-email">{t("email")}</Label>
          <Input
            id="withdraw-email"
            type="email"
            autoComplete="off"
            value={email}
            invalid={showError && !valid}
            aria-describedby={
              showError && !valid ? "withdraw-email-error" : undefined
            }
            placeholder={t("emailPlaceholder")}
            onChange={(e) => setEmail(e.target.value)}
          />
          {showError && !valid ? (
            <span id="withdraw-email-error" className="text-sm text-danger">
              {t("invalidEmail")}
            </span>
          ) : null}
        </div>
        <Button type="submit" intent="danger" tone="outline" fullWidth>
          {t("withdraw")}
        </Button>
        {result ? (
          <p
            role="status"
            className={
              result.kind === "done"
                ? "text-sm text-success"
                : result.kind === "notFound"
                  ? "text-sm text-fg-muted"
                  : "text-sm text-danger"
            }
          >
            {result.kind === "done"
              ? t("done", { email: result.email })
              : result.kind === "notFound"
                ? t("notFound")
                : t("error")}
          </p>
        ) : null}
      </form>

      <Dialog
        open={confirming}
        onOpenChange={(o) => !withdraw.isPending && setConfirming(o)}
      >
        <DialogContent size="md" hideClose className="gap-5">
          <span className="flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-xl">{t("confirmTitle")}</DialogTitle>
            <DialogDescription className="text-base">
              {t.rich("confirmBody", {
                email: trimmed,
                b: (chunks) => (
                  <b className="font-semibold text-fg">{chunks}</b>
                ),
              })}
            </DialogDescription>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              intent="neutral"
              tone="outline"
              size="lg"
              onClick={() => setConfirming(false)}
              disabled={withdraw.isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              intent="danger"
              size="lg"
              onClick={confirm}
              disabled={withdraw.isPending}
              aria-busy={withdraw.isPending || undefined}
            >
              {t("withdraw")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
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
  const debounced = useDebounced(search.trim());

  const list = useOptIns({
    page,
    pageSize: PAGE_SIZE,
    search: debounced || undefined,
  });
  const exporter = useExportOptIns();
  const data = list.data;
  const nf = new Intl.NumberFormat(locale);
  const first = data && data.total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = data ? Math.min(page * PAGE_SIZE, data.total) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-fg">{t("title")}</h1>
          <p className="text-fg-muted">{t("subtitle")}</p>
        </div>
        {canExport ? (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              intent="primary"
              onClick={() => exporter.mutate()}
              disabled={exporter.isPending}
              aria-busy={exporter.isPending || undefined}
            >
              <Download className="size-4" aria-hidden="true" />
              {t("exportCsv")}
            </Button>
            {exporter.isError ? (
              <span role="alert" className="text-sm text-danger">
                {t("exportError")}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <section
          aria-label={t("title")}
          className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface"
        >
          <div className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-fg" aria-live="polite">
              <span className="me-2 text-3xl font-bold">
                {data ? nf.format(data.total) : "—"}
              </span>
              <span className="font-semibold">{t("optedIn")}</span>
            </p>
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

          {list.isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : list.isError && !data ? (
            <p role="alert" className="px-6 py-10 text-center text-danger">
              {t("loadError")}
            </p>
          ) : data && data.items.length === 0 ? (
            <p className="px-6 py-16 text-center text-fg-muted">
              {debounced ? t("noMatches") : t("empty")}
            </p>
          ) : data ? (
            <>
              <table className="hidden w-full text-start md:table">
                <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-start">
                      {t("columns.email")}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start">
                      {t("columns.name")}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start">
                      {t("columns.lastAnswered")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-start">
                      {t("columns.sourceVisit")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr
                      key={item.email}
                      className="border-t border-border align-middle"
                    >
                      <td className="max-w-0 truncate px-6 py-4 text-fg">
                        {item.email}
                      </td>
                      <td className="px-4 py-4 text-fg-muted">
                        {item.fullName ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-fg-muted">
                        {formatWatDateTime(item.consentedAt, locale)}
                      </td>
                      <td className="px-6 py-4">
                        <SourceVisit item={item} onOpen={setVisitId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ul className="flex flex-col md:hidden">
                {data.items.map((item) => (
                  <li
                    key={item.email}
                    className="flex flex-col gap-0.5 border-t border-border px-4 py-3 first:border-t-0"
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

              <div className="flex flex-col gap-2 border-t border-border px-6 py-3 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {t("range", {
                    from: nf.format(first),
                    to: nf.format(last),
                    total: nf.format(data.total),
                  })}
                </span>
                {data.totalPages > 1 ? (
                  <Pagination
                    page={page}
                    totalPages={data.totalPages}
                    onPageChange={setPage}
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </section>

        {canManage ? (
          <div className="w-full shrink-0 xl:w-[400px]">
            <WithdrawConsentCard />
          </div>
        ) : null}
      </div>

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
