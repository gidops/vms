"use client";

import {
  PERMISSIONS,
  type ConsentStatusFilter,
  type OptInItem,
} from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
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
  useGrantConsent,
  useOptIns,
  useWithdrawConsent,
} from "@/data/consent/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { useDebounced } from "@/shared/useDebounced";
import { formatWatDateTime } from "@/shared/wat";
import { FilterPills } from "./FilterPills";

const PAGE_SIZE = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PendingChange {
  email: string;
  /** The status being set: false = remove consent, true = add it back. */
  consent: boolean;
}

/** Opting out needs consent:manage; opting back in needs consent:grant (System Admin). */
function ConsentToggle({
  item,
  canRemove,
  canAdd,
  onRequest,
}: {
  item: OptInItem;
  canRemove: boolean;
  canAdd: boolean;
  onRequest: (change: PendingChange) => void;
}) {
  const t = useTranslations("consent");
  const allowed = item.consent ? canRemove : canAdd;
  const note = allowed
    ? undefined
    : item.consent
      ? t("removeNotAllowed")
      : t("addNotAllowed");
  return (
    <span className="inline-flex" title={note}>
      <Checkbox
        checked={item.consent}
        disabled={!allowed}
        aria-label={t("toggleLabel", { email: item.email })}
        aria-description={note}
        onCheckedChange={(next) =>
          onRequest({ email: item.email, consent: next === true })
        }
      />
    </span>
  );
}

function ConfirmConsentDialog({
  change,
  onClose,
  onDone,
}: {
  change: PendingChange | null;
  onClose: () => void;
  onDone: (change: PendingChange) => void;
}) {
  const t = useTranslations("consent");
  const withdraw = useWithdrawConsent();
  const grant = useGrantConsent();
  const mutation = change?.consent ? grant : withdraw;
  const [failed, setFailed] = React.useState(false);
  const adding = change?.consent === true;

  const confirm = () => {
    if (!change) return;
    setFailed(false);
    mutation.mutate(change.email, {
      onSuccess: (r) => {
        if (r.affected) onDone(change);
        else setFailed(true);
      },
      onError: () => setFailed(true),
    });
  };

  return (
    <Dialog
      open={!!change}
      onOpenChange={(o) => {
        if (mutation.isPending) return;
        if (!o) {
          setFailed(false);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{adding ? t("addTitle") : t("removeTitle")}</DialogTitle>
          <DialogDescription>
            {t.rich(adding ? "addBody" : "removeBody", {
              email: change?.email ?? "",
              b: (chunks) => <b className="font-semibold text-fg">{chunks}</b>,
            })}
          </DialogDescription>
        </DialogHeader>
        {failed ? (
          <Alert intent="danger">
            <AlertDescription>{t("error")}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            intent="neutral"
            tone="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            intent={adding ? "primary" : "danger"}
            onClick={confirm}
            disabled={mutation.isPending}
            aria-busy={mutation.isPending || undefined}
          >
            {adding ? t("confirmAdd") : t("confirmRemove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type WithdrawResult = { kind: "notFound" } | { kind: "error" } | null;

/** Withdrawal is a new consent event: the email leaves the list, past visit records stay unchanged. */
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

/** Current consent per email (latest answer wins); only consent:grant can re-tick a row. */
export function CommsOptInsScreen() {
  const t = useTranslations("consent");
  const locale = useLocale();
  const { hasPermission } = useAuth();
  const canExport = hasPermission(PERMISSIONS.CONSENT_EXPORT);
  const canManage = hasPermission(PERMISSIONS.CONSENT_MANAGE);
  const canGrant = hasPermission(PERMISSIONS.CONSENT_GRANT);

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<ConsentStatusFilter>("in");
  const [page, setPage] = React.useState(1);
  const [pending, setPending] = React.useState<PendingChange | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const debounced = useDebounced(search.trim());

  const list = useOptIns({
    page,
    pageSize: PAGE_SIZE,
    search: debounced || undefined,
    status,
  });
  const exporter = useExportOptIns();
  const data = list.data;
  const nf = new Intl.NumberFormat(locale);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {canManage ? (
          <WithdrawConsentDialog
            onWithdrawn={(email) => setNotice(t("done", { email }))}
          />
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

      {exporter.isError ? (
        <Alert intent="danger">
          <AlertDescription>{t("exportError")}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert intent="success" role="status" className="border-0">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <RecordTable
        frameless
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                className="text-xl font-semibold text-primary"
                aria-live="polite"
              >
                {data ? nf.format(data.total) : "—"}{" "}
                <span className="font-normal text-fg-muted">
                  {t(`count.${status}`)}
                </span>
              </h2>
              <FilterPills<ConsentStatusFilter>
                aria-label={t("filterLabel")}
                value={status}
                onValueChange={(next) => {
                  setStatus(next);
                  setPage(1);
                }}
                options={[
                  { value: "in", label: t("filters.in") },
                  { value: "out", label: t("filters.out") },
                  { value: "all", label: t("filters.all") },
                ]}
              />
            </div>
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
            title={debounced ? t("noMatches") : t(`empty.${status}`)}
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
                    <TableHead>{t("columns.status")}</TableHead>
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
                        {formatWatDateTime(item.answeredAt, locale)}
                      </TableCell>
                      <TableCell>
                        <ConsentToggle
                          item={item}
                          canRemove={canManage}
                          canAdd={canGrant}
                          onRequest={setPending}
                        />
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
                  className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium text-fg">
                      {item.email}
                    </span>
                    <span className="text-sm text-fg-muted">
                      {[
                        item.fullName,
                        formatWatDateTime(item.answeredAt, locale),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <ConsentToggle
                    item={item}
                    canRemove={canManage}
                    canAdd={canGrant}
                    onRequest={setPending}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </RecordTable>

      <ConfirmConsentDialog
        change={pending}
        onClose={() => setPending(null)}
        onDone={(change) => {
          setPending(null);
          setNotice(
            change.consent
              ? t("granted", { email: change.email })
              : t("done", { email: change.email }),
          );
        }}
      />
    </div>
  );
}
