"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import {
  useDeskQrSession,
  useSubmitRegistration,
  useVerifyRegistration,
} from "@/data/desk-qr/public-registration.queries";
import { CodeStep } from "./_components/CodeStep";
import { DoneStep } from "./_components/DoneStep";
import { FormStep } from "./_components/FormStep";
import { FormHeading, Header } from "./_components/Header";
import { StatusScreen } from "./_components/StatusScreen";
import {
  blankSelfForm,
  deadlineOf,
  phaseOf,
  problemOf,
  problemText,
  selfFormErrors,
  toRegistrationInput,
  type SelfForm,
  type SelfFormField,
  type Step,
} from "./self-registration";

/** Visitor self-registration from the desk QR: no login, same day only, confirmed with a code read out at reception. */
export function SelfRegistrationScreen({ token }: { token: string }) {
  const t = useTranslations("selfRegister");
  // Each "Start again" opens a fresh 10-minute form.
  const [attempt, setAttempt] = React.useState(0);
  const [step, setStep] = React.useState<Step>({ kind: "form" });
  const [form, setForm] = React.useState<SelfForm>(blankSelfForm);
  const [showErrors, setShowErrors] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [wrongTries, setWrongTries] = React.useState(0);

  const session = useDeskQrSession(token, attempt);
  const submitter = useSubmitRegistration(token);
  const verifier = useVerifyRegistration(token);
  const busy = submitter.isPending || verifier.isPending;

  const openProblem = session.isError ? problemOf(session.error) : null;
  const phase = phaseOf(
    { loading: session.isLoading, problem: openProblem, data: session.data },
    step,
  );

  const startAgain = () => {
    setStep({ kind: "form" });
    setBanner(null);
    setShowErrors(false);
    setAttempt((n) => n + 1);
  };
  const timeUp = React.useCallback(
    () => setStep({ kind: "expired", timedOut: true }),
    [],
  );

  const patch = (p: Partial<SelfForm>) => setForm((f) => ({ ...f, ...p }));
  const errors = selfFormErrors(form);
  const errorOf = (field: SelfFormField) =>
    showErrors && errors[field] ? t(`errors.${errors[field]}`) : undefined;
  const errorCount = Object.keys(errors).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind !== "form") return;
    setShowErrors(true);
    setBanner(null);
    if (errorCount > 0) return;
    try {
      const pending = await submitter.mutateAsync(
        toRegistrationInput(form, phase.session.formToken),
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
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind !== "code" || !/^\d{6}$/.test(code)) return;
    setBanner(null);
    try {
      const result = await verifier.mutateAsync({
        registrationId: phase.pending.registrationId,
        code,
      });
      setStep({ kind: "done", result });
    } catch (error) {
      const problem = problemOf(error);
      if (problem === "codeWrong") {
        const tries = wrongTries + 1;
        setWrongTries(tries);
        setBanner(t("codeWrong", { left: Math.max(0, 3 - tries) }));
      } else if (problem === "tooManyTries") setStep({ kind: "locked" });
      else if (problem === "expired" || problem === "inactive") {
        setStep({ kind: problem });
        setBanner(null);
      } else setBanner(problemText(t, problem, error));
    }
  };

  let heading: React.ReactNode = null;
  let body: React.ReactNode;
  switch (phase.kind) {
    case "form":
      heading = (
        <FormHeading
          timer={{ deadline: deadlineOf(phase.session), onExpire: timeUp }}
        />
      );
      body = (
        <FormStep
          token={token}
          formToken={phase.session.formToken}
          form={form}
          patch={patch}
          errorOf={errorOf}
          showErrors={showErrors}
          // Counts down live as the visitor fixes answers; gone once all are fine.
          banner={
            banner ??
            (showErrors && errorCount > 0
              ? t("checkAnswers", { count: errorCount })
              : null)
          }
          busy={busy}
          onSubmit={submit}
        />
      );
      break;
    case "code":
      heading = <h1 className="text-2xl font-bold">{t("code.heading")}</h1>;
      body = (
        <CodeStep
          code={code}
          onCodeChange={setCode}
          banner={banner}
          busy={busy}
          deadline={deadlineOf(phase.pending)}
          onExpire={timeUp}
          onSubmit={verify}
        />
      );
      break;
    case "done":
      body = <DoneStep result={phase.result} />;
      break;
    default:
      if (phase.kind === "opening") heading = <FormHeading />;
      body = (
        <StatusScreen
          kind={phase.kind}
          message={
            openProblem && openProblem !== "inactive"
              ? problemText(t, openProblem, session.error)
              : banner
          }
          focusTitle={phase.kind === "expired" && phase.timedOut}
          onStartAgain={startAgain}
        />
      );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-surface">
      <Header>{heading}</Header>
      {body}
    </main>
  );
}
