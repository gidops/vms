"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FLOORS,
  VISIT_PURPOSES,
  type PublicRegistrationPending,
  type PublicRegistrationResult,
} from "@vms/contracts";
import {
  Alert,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  YesNoControl,
  cn,
} from "@vms/ui";
import {
  CalendarDays,
  CircleCheck,
  Clock,
  QrCode,
  Search,
  X,
} from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { EvacuationAssistFields } from "@/app/[locale]/_components/EvacuationAssist";
import { LanguageSwitcher } from "@/app/[locale]/_components/LanguageSwitcher";
import { PhoneInput } from "@/app/[locale]/_components/PhoneInput";
import { publicRegistrationApi } from "@/data/desk-qr/desk-qr.api";
import {
  blankSelfForm,
  problemOf,
  selfFormErrors,
  toRegistrationInput,
  type RegistrationProblem,
  type SelfForm,
  type SelfFormField,
} from "./self-registration";

type Step =
  | { kind: "form" }
  | { kind: "inactive" }
  | { kind: "code"; pending: PublicRegistrationPending }
  | { kind: "done"; result: PublicRegistrationResult }
  | { kind: "expired" }
  | { kind: "locked" };

/** What the screen shows: the step, unless opening, closed or timed out. */
type Phase =
  | Exclude<Step, { kind: "form" }>
  | { kind: "opening" }
  | { kind: "form"; formToken: string; formExpiresAt: Date };

const NO_FLOOR = "__none";

function Header({ children }: { children?: React.ReactNode }) {
  const t = useTranslations("selfRegister");
  return (
    <header className="flex flex-col gap-3 bg-emphasis px-5 pt-4 pb-5 text-emphasis-fg">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/afreximbank.svg" alt="" className="size-8" />
        <span className="text-sm font-semibold">{t("brand")}</span>
        <span className="ms-auto">
          <LanguageSwitcher />
        </span>
      </div>
      {children}
    </header>
  );
}

function Centered({
  icon,
  tone,
  title,
  children,
}: {
  icon: React.ReactNode;
  tone: "success" | "warning" | "info";
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-1 flex-col items-center gap-4 px-6 py-12 text-center">
      <span
        className={cn(
          "flex size-18 items-center justify-center rounded-full [&_svg]:size-9",
          tone === "success" && "bg-success-subtle text-success",
          tone === "warning" && "bg-warning-subtle text-warning",
          tone === "info" && "bg-info-subtle text-info",
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2 className="text-2xl font-bold text-balance text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  required,
  optional,
  error,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("selfRegister");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
        {optional ? (
          <span className="ms-1.5 font-normal text-fg-subtle">
            {t("optional")}
          </span>
        ) : null}
      </Label>
      {children}
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  );
}

/** "Who are you visiting?": search staff by name (names and units only). */
function HostPicker({
  token,
  value,
  onChange,
}: {
  token: string;
  value: SelfForm["host"];
  onChange: (host: SelfForm["host"]) => void;
}) {
  const t = useTranslations("selfRegister");
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const hosts = useQuery({
    queryKey: ["public-hosts", token, debounced],
    queryFn: () => publicRegistrationApi.searchHosts(token, debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-primary-subtle px-3 py-2.5">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium text-fg">{value.fullName}</span>
          {value.department ? (
            <span className="text-xs text-fg-muted">{value.department}</span>
          ) : null}
        </span>
        <Button
          size="sm"
          intent="neutral"
          tone="ghost"
          onClick={() => onChange(null)}
          aria-label={t("host.remove", { name: value.fullName })}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-fg-muted"
          aria-hidden="true"
        />
        <Input
          id="sr-host"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("host.placeholder")}
          autoComplete="off"
          className="ps-9"
        />
      </div>
      {debounced.length >= 2 && hosts.data ? (
        <ul
          className="overflow-hidden rounded-lg border border-border shadow-sm"
          aria-label={t("host.results")}
        >
          {hosts.data.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-fg-muted">
              {t("host.none")}
            </li>
          ) : (
            hosts.data.map((h) => (
              <li
                key={h.userId}
                className="border-b border-border last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(h);
                    setQ("");
                  }}
                  className="flex w-full flex-col px-3 py-2.5 text-start text-sm outline-none hover:bg-primary-subtle focus-visible:bg-primary-subtle"
                >
                  <span className="font-medium text-fg">{h.fullName}</span>
                  {h.department ? (
                    <span className="text-xs text-fg-muted">
                      {h.department}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      <span className="text-xs text-fg-muted">{t("host.help")}</span>
    </div>
  );
}

function YesNo({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  error?: string;
}) {
  const t = useTranslations("selfRegister");
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-medium text-fg">
        {label} <span className="text-danger">*</span>
      </span>
      <YesNoControl
        id={id}
        value={value}
        onValueChange={onChange}
        yesLabel={t("yes")}
        noLabel={t("no")}
        invalid={Boolean(error)}
        aria-labelledby={`${id}-label`}
        fullWidth
      />
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  );
}

function problemText(
  t: (key: "problems.offline" | "problems.unknown") => string,
  problem: RegistrationProblem,
  err: unknown,
): string {
  if (problem === "offline") return t("problems.offline");
  // Everything else comes back from the server already in the visitor's language.
  return err instanceof Error && err.message
    ? err.message
    : t("problems.unknown");
}

/** Visitor self-registration from the desk QR: no login, same day only, confirmed with a code read out at reception. */
export function SelfRegistrationScreen({ token }: { token: string }) {
  const t = useTranslations("selfRegister");
  const tf = useTranslations("invite.fields");
  const format = useFormatter();
  const now = useNow({ updateInterval: 1_000 });
  // Each "Start again" opens a fresh 10-minute form.
  const [attempt, setAttempt] = React.useState(0);
  const [step, setStep] = React.useState<Step>({ kind: "form" });
  const [form, setForm] = React.useState<SelfForm>(blankSelfForm);
  const [showErrors, setShowErrors] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [wrongTries, setWrongTries] = React.useState(0);

  const session = useQuery({
    queryKey: ["desk-qr-form", token, attempt],
    queryFn: () => publicRegistrationApi.open(token),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const startAgain = () => {
    setStep({ kind: "form" });
    setBanner(null);
    setShowErrors(false);
    setAttempt((n) => n + 1);
  };

  // The form and the code each expire after 10 minutes.
  const deadline =
    step.kind === "form" && session.data
      ? new Date(session.data.formExpiresAt)
      : step.kind === "code"
        ? new Date(step.pending.codeExpiresAt)
        : null;
  const secondsLeft = deadline
    ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000))
    : null;

  const openProblem = session.isError ? problemOf(session.error) : null;
  const phase: Phase = session.isLoading
    ? { kind: "opening" }
    : openProblem === "inactive"
      ? { kind: "inactive" }
      : openProblem
        ? { kind: "expired" }
        : secondsLeft === 0
          ? { kind: "expired" }
          : step.kind === "form" && session.data
            ? {
                kind: "form",
                formToken: session.data.formToken,
                formExpiresAt: new Date(session.data.formExpiresAt),
              }
            : step.kind === "form"
              ? { kind: "opening" }
              : step;
  const openBanner =
    openProblem && openProblem !== "inactive"
      ? problemText(t, openProblem, session.error)
      : null;
  const patch = (p: Partial<SelfForm>) => setForm((f) => ({ ...f, ...p }));
  const errors = selfFormErrors(form);
  const err = (field: SelfFormField) =>
    showErrors && errors[field] ? t(`errors.${errors[field]}`) : undefined;
  const errorCount = Object.keys(errors).length;
  // Counts down live as the visitor fixes answers; gone once all are fine.
  const formBanner =
    banner ??
    (showErrors && errorCount > 0
      ? t("checkAnswers", { count: errorCount })
      : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind !== "form") return;
    setShowErrors(true);
    setBanner(null);
    if (errorCount > 0) return;
    setBusy(true);
    setBanner(null);
    try {
      const pending = await publicRegistrationApi.submit(
        token,
        toRegistrationInput(form, phase.formToken),
      );
      setCode("");
      setWrongTries(0);
      setStep({ kind: "code", pending });
    } catch (error) {
      const problem = problemOf(error);
      if (problem === "inactive") setStep({ kind: "inactive" });
      else if (problem === "expired" || problem === "codeWrong") {
        // 410 or a rejected form token: start again.
        setStep({ kind: "expired" });
        setBanner(problemText(t, problem, error));
      } else setBanner(problemText(t, problem, error));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind !== "code" || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setBanner(null);
    try {
      const result = await publicRegistrationApi.verify(
        token,
        phase.pending.registrationId,
        code,
      );
      setStep({ kind: "done", result });
    } catch (error) {
      const problem = problemOf(error);
      if (problem === "codeWrong") {
        const tries = wrongTries + 1;
        setWrongTries(tries);
        setBanner(t("codeWrong", { left: Math.max(0, 3 - tries) }));
      } else if (problem === "tooManyTries") setStep({ kind: "locked" });
      else if (problem === "expired" || problem === "inactive") {
        setStep({ kind: problem === "inactive" ? "inactive" : "expired" });
        setBanner(null);
      } else setBanner(problemText(t, problem, error));
    } finally {
      setBusy(false);
    }
  };

  const countdown =
    secondsLeft !== null
      ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
      : "";

  const today = format.dateTime(now, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let body: React.ReactNode;
  switch (phase.kind) {
    case "opening":
      body = (
        <div className="flex flex-1 items-center justify-center py-20">
          <Spinner />
        </div>
      );
      break;
    case "inactive":
      body = (
        <Centered icon={<QrCode />} tone="warning" title={t("inactive.title")}>
          <p className="max-w-xs text-fg-muted">{t("inactive.body")}</p>
        </Centered>
      );
      break;
    case "expired":
    case "locked":
      body = (
        <Centered
          icon={<Clock />}
          tone="warning"
          title={
            phase.kind === "locked" ? t("locked.title") : t("expired.title")
          }
        >
          <p className="max-w-xs text-fg-muted">
            {openBanner ??
              banner ??
              (phase.kind === "locked" ? t("locked.body") : t("expired.body"))}
          </p>
          <Button intent="primary" size="lg" onClick={startAgain}>
            {t("startAgain")}
          </Button>
        </Centered>
      );
      break;
    case "done":
      body = (
        <Centered icon={<CircleCheck />} tone="success" title={t("done.title")}>
          <p className="max-w-xs text-fg-muted">{t("done.body")}</p>
          <span
            className="rounded-xl bg-accent px-6 py-3 font-mono text-3xl font-semibold tracking-[0.2em] text-accent-fg"
            dir="ltr"
          >
            {phase.result.referenceCode}
          </span>
          <dl className="grid w-full max-w-sm grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-xl border border-border p-4 text-start text-sm">
            <dt className="text-fg-muted">{t("done.name")}</dt>
            <dd className="font-medium text-fg">{phase.result.fullName}</dd>
            {phase.result.hostName ? (
              <>
                <dt className="text-fg-muted">{t("done.visiting")}</dt>
                <dd className="font-medium text-fg">{phase.result.hostName}</dd>
              </>
            ) : null}
            <dt className="text-fg-muted">{t("done.when")}</dt>
            <dd className="font-medium text-fg">
              {format.dateTime(new Date(phase.result.visitDate), {
                dateStyle: "medium",
              })}
            </dd>
          </dl>
        </Centered>
      );
      break;
    case "code":
      body = (
        <form
          noValidate
          onSubmit={verify}
          className="flex flex-1 flex-col items-center gap-4 px-6 py-10 text-center"
        >
          <span
            className="flex size-18 items-center justify-center rounded-full bg-info-subtle text-info [&_svg]:size-9"
            aria-hidden="true"
          >
            <Clock />
          </span>
          <h2 className="text-2xl font-bold text-fg">{t("code.title")}</h2>
          <p className="max-w-xs text-fg-muted">{t("code.body")}</p>
          {banner ? (
            <Alert intent="danger" className="w-full text-start">
              <span>{banner}</span>
            </Alert>
          ) : null}
          <Label htmlFor="sr-code" className="sr-only">
            {t("code.label")}
          </Label>
          <Input
            id="sr-code"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            dir="ltr"
            className="h-14 max-w-60 text-center font-mono text-3xl tracking-[0.5em]"
          />
          <Button
            type="submit"
            intent="primary"
            size="lg"
            className="w-full max-w-sm"
            disabled={busy || code.length !== 6}
            aria-busy={busy || undefined}
          >
            {t("code.confirm")}
          </Button>
          <span className="text-sm text-fg-muted">
            {t("code.expires", { countdown })}
          </span>
        </form>
      );
      break;
    case "form":
      body = (
        <form noValidate onSubmit={submit} className="flex flex-1 flex-col">
          <div className="flex flex-col gap-5 px-5 py-6">
            {formBanner ? (
              <Alert intent="danger">
                <span>{formBanner}</span>
              </Alert>
            ) : null}

            {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
            <div
              aria-hidden="true"
              className="absolute -start-[9999px] size-px overflow-hidden"
            >
              <label htmlFor="sr-website">Website</label>
              <input
                id="sr-website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => patch({ website: e.target.value })}
              />
            </div>

            <h3 className="text-sm font-semibold tracking-wide text-primary uppercase">
              {t("sections.contact")}
            </h3>
            <Field
              id="sr-email"
              label={t("fields.email")}
              required
              error={err("email")}
            >
              <Input
                id="sr-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => patch({ email: e.target.value })}
                placeholder="name@company.com"
                aria-invalid={Boolean(err("email")) || undefined}
              />
            </Field>
            <Field
              id="sr-phone"
              label={t("fields.phone")}
              optional
              error={err("phone")}
            >
              <PhoneInput
                id="sr-phone"
                code={form.phoneCode}
                number={form.phoneNumber}
                onCodeChange={(phoneCode) => patch({ phoneCode })}
                onNumberChange={(phoneNumber) => patch({ phoneNumber })}
                placeholder="801 234 5678"
                invalid={Boolean(err("phone"))}
              />
            </Field>

            <h3 className="text-sm font-semibold tracking-wide text-primary uppercase">
              {t("sections.about")}
            </h3>
            <Field
              id="sr-name"
              label={t("fields.fullName")}
              required
              error={err("fullName")}
            >
              <Input
                id="sr-name"
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => patch({ fullName: e.target.value })}
                aria-invalid={Boolean(err("fullName")) || undefined}
              />
            </Field>
            <Field
              id="sr-org"
              label={t("fields.organization")}
              required
              error={err("organization")}
            >
              <Input
                id="sr-org"
                autoComplete="organization"
                value={form.organization}
                onChange={(e) => patch({ organization: e.target.value })}
                aria-invalid={Boolean(err("organization")) || undefined}
              />
            </Field>

            <h3 className="text-sm font-semibold tracking-wide text-primary uppercase">
              {t("sections.visiting")}
            </h3>
            <HostPicker
              token={token}
              value={form.host}
              onChange={(host) => patch({ host })}
            />

            <h3 className="text-sm font-semibold tracking-wide text-primary uppercase">
              {t("sections.visit")}
            </h3>
            <Field id="sr-floor" label={t("fields.floor")} optional>
              <Select
                value={form.floor || NO_FLOOR}
                onValueChange={(v) => patch({ floor: v === NO_FLOOR ? "" : v })}
              >
                <SelectTrigger id="sr-floor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FLOOR}>
                    {t("fields.floorNotSure")}
                  </SelectItem>
                  {FLOORS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="sr-purpose"
              label={t("fields.purpose")}
              required
              error={err("purpose")}
            >
              <Select
                value={form.purpose}
                onValueChange={(purpose) => patch({ purpose })}
              >
                <SelectTrigger
                  id="sr-purpose"
                  aria-invalid={Boolean(err("purpose")) || undefined}
                >
                  <SelectValue placeholder={tf("purposePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_PURPOSES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <h3 className="text-sm font-semibold tracking-wide text-primary uppercase">
              {t("sections.safety")}
            </h3>
            <YesNo
              id="sr-evacuation"
              label={t("fields.evacuation")}
              value={form.needsEvacuationAssist}
              onChange={(v) =>
                patch(
                  v
                    ? { needsEvacuationAssist: v }
                    : {
                        needsEvacuationAssist: v,
                        evacuationAssistTypes: [],
                        evacuationAssistOther: "",
                      },
                )
              }
              error={err("needsEvacuationAssist")}
            />
            {form.needsEvacuationAssist ? (
              <EvacuationAssistFields
                id="sr-evacuation-types"
                value={{
                  evacuationAssistTypes: form.evacuationAssistTypes,
                  evacuationAssistOther: form.evacuationAssistOther,
                }}
                onChange={patch}
                showErrors={showErrors}
              />
            ) : null}
            <YesNo
              id="sr-consent"
              label={t("fields.consent")}
              value={form.commsConsent}
              onChange={(v) => patch({ commsConsent: v })}
              error={err("commsConsent")}
            />
          </div>
          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              intent="primary"
              size="lg"
              fullWidth
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {t("submit")}
            </Button>
            <p className="text-center text-xs text-fg-muted">
              {t("submitHelp")}
            </p>
          </div>
        </form>
      );
      break;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-surface">
      <Header>
        {phase.kind === "form" || phase.kind === "opening" ? (
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-emphasis-fg/75">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                {t("today", { date: today })}
              </span>
              {phase.kind === "form" ? (
                <span
                  className="inline-flex items-center gap-1.5"
                  aria-live="off"
                >
                  <Clock className="size-4" aria-hidden="true" />
                  {t("expiresIn", { countdown })}
                </span>
              ) : null}
            </span>
          </div>
        ) : phase.kind === "code" ? (
          <h1 className="text-2xl font-bold">{t("code.heading")}</h1>
        ) : null}
      </Header>
      {body}
    </main>
  );
}
