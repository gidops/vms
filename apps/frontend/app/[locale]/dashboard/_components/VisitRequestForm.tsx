"use client";

import type { CreateVisitsInput } from "@vms/contracts";
import { FLOORS, VISIT_PURPOSES } from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  Button,
  DetailSection,
  DrawerClose,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@vms/ui";
import { Download, UserPlus, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { useHosts } from "@/data/hosts/queries";
import { useCreateVisits } from "@/data/requests/queries";
import { Stepper } from "./Stepper";
import {
  VisitorFields,
  visitorErrors,
  type VisitorEntry,
} from "./VisitorFields";
import { downloadGuestTemplate, parseGuestsCsv } from "./csv";

export type VisitFormMode = "walkin" | "invite";

type Pane = "visitors" | "host" | "visit" | "summary";

function blankVisitor(): VisitorEntry {
  return {
    id: crypto.randomUUID(),
    fullName: "",
    email: "",
    organization: "",
    phone: "",
  };
}

function visitorValid(v: VisitorEntry): boolean {
  const e = visitorErrors(v);
  return !e.fullName && !e.email && !e.organization;
}

export function VisitRequestForm({
  mode,
  onClose,
}: {
  mode: VisitFormMode;
  onClose: () => void;
}) {
  const t = useTranslations("invite");
  const format = useFormatter();
  const hosts = useHosts();
  const create = useCreateVisits();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const panes: Pane[] =
    mode === "invite" ? ["visitors", "host", "summary"] : ["visit", "summary"];
  const stepLabels =
    mode === "invite"
      ? [t("steps.visitor"), t("steps.host"), t("steps.summary")]
      : [t("steps.visit"), t("steps.summary")];

  const [step, setStep] = React.useState(0);
  const [showErrors, setShowErrors] = React.useState(false);
  const [showAllVisitors, setShowAllVisitors] = React.useState(false);
  const [visitors, setVisitors] = React.useState<VisitorEntry[]>([
    blankVisitor(),
  ]);
  const [hostUserId, setHostUserId] = React.useState("");
  const [floor, setFloor] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const pane = panes[step];
  const isLast = step === panes.length - 1;
  const hostList = hosts.data ?? [];
  const hostName = hostList.find((h) => h.userId === hostUserId)?.fullName ?? "";

  const visitorsValid = visitors.every(visitorValid);
  const detailsValid =
    Boolean(hostUserId) &&
    Boolean(floor) &&
    Boolean(purpose) &&
    (mode === "invite" ? Boolean(scheduledAt) : true);

  function paneValid(p: Pane): boolean {
    if (p === "visitors") return visitorsValid;
    if (p === "host") return detailsValid;
    if (p === "visit") return visitorsValid && detailsValid;
    return true;
  }

  // ── Visitor list helpers ────────────────────────────────────────────────
  const patchVisitor = (i: number, patch: Partial<VisitorEntry>) =>
    setVisitors((prev) =>
      prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
    );
  const addVisitor = () => setVisitors((prev) => [...prev, blankVisitor()]);
  const removeVisitor = (i: number) =>
    setVisitors((prev) => prev.filter((_, idx) => idx !== i));

  async function onImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const rows = await parseGuestsCsv(file);
      if (rows.length === 0) return;
      setVisitors(
        rows.map((r) => ({
          id: crypto.randomUUID(),
          fullName: r.fullName,
          email: r.email,
          organization: r.organization,
          phone: r.phone,
        })),
      );
      // Preselect host from the first row that carries a matching host email.
      const withHost = rows.find((r) => r.hostEmail);
      if (withHost) {
        const match = hostList.find(
          (h) => h.email.toLowerCase() === withHost.hostEmail.toLowerCase(),
        );
        if (match) setHostUserId(match.userId);
      }
    } catch {
      /* ignore malformed CSV; the user can re-import */
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────
  function next() {
    if (!paneValid(pane)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => Math.min(s + 1, panes.length - 1));
  }
  function back() {
    setShowErrors(false);
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    const input: CreateVisitsInput = {
      type: mode === "walkin" ? "WALK_IN" : "PRE_INVITED",
      hostUserId,
      floor,
      purpose,
      scheduledAt:
        mode === "invite" && scheduledAt ? new Date(scheduledAt) : undefined,
      notes: mode === "walkin" && notes.trim() ? notes.trim() : undefined,
      visitors: visitors.map((v) => ({
        fullName: v.fullName.trim(),
        email: v.email.trim(),
        phone: v.phone.trim() || undefined,
        organization: v.organization.trim() || undefined,
      })),
    };
    create.mutate(input, { onSuccess: () => onClose() });
  }

  const primaryLabel = isLast
    ? mode === "walkin"
      ? t("submitWalkin")
      : t("submitInvite")
    : panes[step + 1] === "host"
      ? t("goToHost")
      : t("review");

  return (
    <>
      {/* Header (white) */}
      <div className="flex flex-col gap-1 border-b border-border p-5 pe-12">
        <h2 className="text-xl font-semibold text-fg">
          {mode === "walkin" ? t("titleWalkin") : t("titleInvite")}
        </h2>
        <p className="text-sm text-fg-muted">{t("subtitle")}</p>
      </div>

      {/* Stepper band (dark green) */}
      <div className="bg-emphasis px-5 py-4 text-emphasis-fg">
        <Stepper steps={stepLabels} current={step} />
      </div>

      {/* Body (scrollable) */}
      <div className="flex-1 overflow-y-auto p-5">
        {pane === "visitors" || pane === "visit" ? (
          <div className="flex flex-col gap-6">
            {mode === "invite" ? (
              <div className="flex flex-col gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={onImportCsv}
                />
                <Button
                  type="button"
                  intent="primary"
                  tone="outline"
                  fullWidth
                  onClick={() => fileRef.current?.click()}
                >
                  <UserPlus className="size-4" aria-hidden="true" />
                  {t("importCsv")}
                </Button>
                <Button
                  type="button"
                  intent="primary"
                  tone="outline"
                  fullWidth
                  onClick={downloadGuestTemplate}
                >
                  <Download className="size-4" aria-hidden="true" />
                  {t("downloadTemplate")}
                </Button>
              </div>
            ) : null}

            <SectionHeader>{t("sections.visitorDetails")}</SectionHeader>
            {visitors.map((v, i) => (
              <VisitorFields
                key={v.id}
                value={v}
                index={i}
                canRemove={visitors.length > 1}
                showErrors={showErrors}
                onChange={(patch) => patchVisitor(i, patch)}
                onRemove={() => removeVisitor(i)}
              />
            ))}
            <Button
              type="button"
              intent="primary"
              tone="ghost"
              fullWidth
              className="border border-dashed border-primary"
              onClick={addVisitor}
            >
              <Users className="size-4" aria-hidden="true" />
              {t("addVisitor")}
            </Button>

            {pane === "visit" ? (
              <>
                <SectionHeader>{t("sections.visitPurpose")}</SectionHeader>
                <HostVisitFields
                  mode={mode}
                  hostList={hostList}
                  hostUserId={hostUserId}
                  setHostUserId={setHostUserId}
                  floor={floor}
                  setFloor={setFloor}
                  purpose={purpose}
                  setPurpose={setPurpose}
                  scheduledAt={scheduledAt}
                  setScheduledAt={setScheduledAt}
                  notes={notes}
                  setNotes={setNotes}
                  showErrors={showErrors}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {pane === "host" ? (
          <HostVisitFields
            mode={mode}
            hostList={hostList}
            hostUserId={hostUserId}
            setHostUserId={setHostUserId}
            floor={floor}
            setFloor={setFloor}
            purpose={purpose}
            setPurpose={setPurpose}
            scheduledAt={scheduledAt}
            setScheduledAt={setScheduledAt}
            notes={notes}
            setNotes={setNotes}
            showErrors={showErrors}
          />
        ) : null}

        {pane === "summary" ? (
          <div className="flex flex-col gap-6">
            <DetailSection title={t("sections.visitorDetails")}>
              {(showAllVisitors ? visitors : visitors.slice(0, 1)).map((v) => (
                <SummaryVisitor key={v.id} v={v} />
              ))}
              {visitors.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setShowAllVisitors((s) => !s)}
                  className="self-end text-sm font-medium text-primary underline"
                >
                  {showAllVisitors
                    ? t("showLessVisitors")
                    : t("showAllVisitors", { count: visitors.length })}
                </button>
              ) : null}
            </DetailSection>

            <DetailSection title={t("sections.hostDetails")}>
              <SummaryRow label={t("summary.host")} value={hostName} />
              <SummaryRow label={t("fields.floor")} value={floor} />
              <SummaryRow label={t("fields.purpose")} value={purpose} />
              {mode === "invite" ? (
                <SummaryRow
                  label={t("summary.dateTime")}
                  value={
                    scheduledAt
                      ? format.dateTime(new Date(scheduledAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"
                  }
                />
              ) : null}
              {mode === "walkin" && notes.trim() ? (
                <SummaryRow label={t("fields.notes")} value={notes.trim()} />
              ) : null}
              <SummaryRow
                label={t("summary.clearance")}
                value={mode === "walkin" ? t("summary.approved") : t("summary.pending")}
                accent
              />
            </DetailSection>
          </div>
        ) : null}

        {create.isError ? (
          <Alert intent="danger" className="mt-4">
            <AlertDescription>{t("submitError")}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      {/* Footer (sticky) */}
      <div className="flex items-center gap-2 border-t border-border p-4">
        {step > 0 ? (
          <Button
            type="button"
            intent="neutral"
            tone="ghost"
            onClick={back}
            disabled={create.isPending}
          >
            {t("back")}
          </Button>
        ) : (
          <DrawerClose asChild>
            <Button type="button" intent="neutral" tone="ghost">
              {t("cancel")}
            </Button>
          </DrawerClose>
        )}
        <Button
          type="button"
          intent="primary"
          fullWidth
          onClick={isLast ? submit : next}
          disabled={create.isPending}
        >
          {create.isPending ? t("submitting") : primaryLabel}
        </Button>
      </div>
    </>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-primary-subtle px-4 py-3 text-base font-semibold text-primary">
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-fg-subtle">
        {label}
      </span>
      <span
        className={accent ? "font-semibold text-warning" : "text-sm text-fg"}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function SummaryVisitor({ v }: { v: VisitorEntry }) {
  const t = useTranslations("invite");
  return (
    <div className="flex flex-col gap-2 border-b border-dashed border-border pb-3 last:border-0">
      <SummaryRow label={t("fields.fullName")} value={v.fullName} />
      <SummaryRow label={t("fields.email")} value={v.email} />
      {v.phone ? <SummaryRow label={t("fields.phone")} value={v.phone} /> : null}
      <SummaryRow label={t("fields.organization")} value={v.organization} />
    </div>
  );
}

/** Host + floor + purpose (+ date for invite, notes for walk-in). */
function HostVisitFields(props: {
  mode: VisitFormMode;
  hostList: { userId: string; fullName: string; email: string }[];
  hostUserId: string;
  setHostUserId: (v: string) => void;
  floor: string;
  setFloor: (v: string) => void;
  purpose: string;
  setPurpose: (v: string) => void;
  scheduledAt: string;
  setScheduledAt: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  showErrors: boolean;
}) {
  const t = useTranslations("invite");
  const {
    mode,
    hostList,
    hostUserId,
    setHostUserId,
    floor,
    setFloor,
    purpose,
    setPurpose,
    scheduledAt,
    setScheduledAt,
    notes,
    setNotes,
    showErrors,
  } = props;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>
          {t("fields.host")} <span className="text-danger">*</span>
        </Label>
        <Select value={hostUserId} onValueChange={setHostUserId}>
          <SelectTrigger
            className={"w-full" + (showErrors && !hostUserId ? " border-danger" : "")}
          >
            <SelectValue placeholder={t("fields.hostPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {hostList.map((h) => (
              <SelectItem key={h.userId} value={h.userId}>
                {h.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>
          {t("fields.floor")} <span className="text-danger">*</span>
        </Label>
        <Select value={floor} onValueChange={setFloor}>
          <SelectTrigger
            className={"w-full" + (showErrors && !floor ? " border-danger" : "")}
          >
            <SelectValue placeholder={t("fields.floorPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {FLOORS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>
          {t("fields.purpose")} <span className="text-danger">*</span>
        </Label>
        <Select value={purpose} onValueChange={setPurpose}>
          <SelectTrigger
            className={"w-full" + (showErrors && !purpose ? " border-danger" : "")}
          >
            <SelectValue placeholder={t("fields.purposePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {VISIT_PURPOSES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === "invite" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scheduledAt">
            {t("fields.dateTime")} <span className="text-danger">*</span>
          </Label>
          <Input
            id="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            invalid={showErrors && !scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">{t("fields.notes")}</Label>
          <Textarea
            id="notes"
            value={notes}
            placeholder={t("fields.notesPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
