"use client";

import {
  Avatar,
  Badge,
  Button,
  DetailDrawer,
  DetailSection,
  Spinner,
  Textarea,
  Timeline,
  type TimelineStep,
} from "@vms/ui";
import { parsePhone } from "@vms/contracts";
import { Loader2, Send, Star, TriangleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { DIAL_CODES } from "@/app/[locale]/_components/PhoneInput";
import { GuestBlock } from "@/app/[locale]/dashboard/_components/GuestBlock";
import {
  blankGuest,
  formatPhone,
  scheduledAtOf,
  type GuestEntry,
} from "@/app/[locale]/dashboard/_components/guest-form";
import { CheckInModal } from "@/app/[locale]/dashboard/_components/checkin/CheckInModal";
import { CheckOutModal } from "@/app/[locale]/dashboard/_components/checkin/CheckOutModal";
import type { AlertDetail } from "@/data/alerts/alerts.api";
import type { StaffActivityCategory } from "@/data/staff/staff.api";
import { useHosts } from "@/data/hosts/queries";
import {
  useAddNote,
  useAlert,
  useApproveVisit,
  useCancelVisit,
  useDenyVisit,
  useRateVisit,
  useResendCode,
  useResubmitVisit,
  useUpdateVisit,
  useVisitRequest,
} from "@/data/requests/queries";
import type { VisitNote, VisitRequestDetail } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";

export interface SelectedItem {
  kind: "request" | "alert";
  id: string;
}

type VisitStatus = VisitRequestDetail["status"];

const TERMINAL: VisitStatus[] = [
  "DENIED",
  "CANCELLED",
  "CHECKED_OUT",
  "EXPIRED",
];

/**
 * Derive the 4-step "Track visit progress" states from a visit status:
 * Awaiting CSO Approval → Checked In → Issued Pass → Checked out. A checked-in
 * visitor advances past "Issued Pass" only once a physical pass is assigned.
 */
function timelineFor(
  status: VisitStatus,
  labels: Record<string, string>,
  hasPass: boolean,
): TimelineStep[] {
  const order = ["awaitingCso", "checkedIn", "passIssued", "checkedOut"] as const;
  const progress: Record<string, number> = {
    PENDING: 0,
    NEEDS_MORE_INFO: 0,
    DENIED: 0,
    CANCELLED: 0,
    EXPIRED: 0,
    APPROVED: 1,
    CHECKED_IN: 2,
    CHECKED_OUT: 4,
  };
  let p = progress[status] ?? 0;
  if (status === "CHECKED_IN" && hasPass) p = 3;
  return order.map((key, i) => ({
    key,
    label: labels[key] ?? key,
    state: i < p ? "complete" : i === p ? "current" : "upcoming",
  }));
}

/** Elapsed HH:MM:SS between two ISO timestamps, suffixed for the summary grid. */
function durationHms(from: string, to: string): string {
  const secs = Math.max(
    0,
    Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 1000),
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(secs / 3600))}:${pad(
    Math.floor((secs % 3600) / 60),
  )}:${pad(secs % 60)}`;
}

/** A labelled field in the Visit Summary grid. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-fg-subtle">
        {label}
      </span>
      <span className="text-sm text-fg">{children}</span>
    </div>
  );
}

/** QR + invite reference code + "Send CODE to guest" beside the progress stepper. */
function QrPanel({
  visitId,
  qrCode,
  referenceCode,
}: {
  visitId: string;
  qrCode?: string | null;
  referenceCode?: string | null;
}) {
  const t = useTranslations("requests");
  const resend = useResendCode(visitId);
  if (!qrCode && !referenceCode) return null;
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      {qrCode ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrCode} alt="" className="size-28 rounded-md" aria-hidden="true" />
      ) : null}
      {referenceCode ? (
        <span className="rounded-md bg-accent px-3 py-1.5 text-center font-mono text-sm font-semibold tracking-[0.25em] text-accent-fg">
          {referenceCode}
        </span>
      ) : null}
      {referenceCode ? (
        <button
          type="button"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
          className="text-xs font-medium text-primary underline disabled:opacity-50"
        >
          {resend.isSuccess ? t("codeSent") : t("sendCode")}
        </button>
      ) : null}
    </div>
  );
}

function NoteList({
  notes,
  emptyLabel,
}: {
  notes: VisitNote[];
  emptyLabel: string;
}) {
  const format = useFormatter();
  if (notes.length === 0)
    return <p className="text-sm text-fg-subtle">{emptyLabel}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg border border-border p-3">
          <p className="text-sm text-fg">{note.body}</p>
          <p className="mt-1 text-xs text-fg-subtle">
            {note.authorName} ·{" "}
            {format.dateTime(new Date(note.createdAt), {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Inline note composer with a send-icon button (always visible under the notes
 * list), used for both visit remarks and alert responses. Shows an "Adding
 * note" indicator while the mutation is in flight.
 */
function NoteComposer({
  target,
  placeholder,
}: {
  target: { visitId?: string; alertId?: string };
  placeholder?: string;
}) {
  const t = useTranslations("requests");
  const [body, setBody] = React.useState("");
  const addNote = useAddNote(target);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || addNote.isPending) return;
    addNote.mutate(body.trim(), { onSuccess: () => setBody("") });
  };

  return (
    <form className="flex flex-col gap-1.5" onSubmit={submit}>
      <div className="relative">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder ?? t("addNotePlaceholder")}
          rows={3}
          className="pe-12"
        />
        <button
          type="submit"
          disabled={!body.trim() || addNote.isPending}
          aria-label={t("actions.addNote")}
          className="absolute bottom-3 end-3 text-primary transition-opacity disabled:opacity-40"
        >
          {addNote.isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-5 rtl:-scale-x-100" aria-hidden="true" />
          )}
        </button>
      </div>
      {addNote.isPending ? (
        <span className="flex items-center gap-1.5 text-xs text-fg-muted">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t("addingNote")}
        </span>
      ) : null}
    </form>
  );
}

function DenyForm({
  onSubmit,
  onCancel,
  pending,
}: {
  onSubmit: (reason: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const t = useTranslations("requests");
  const [reason, setReason] = React.useState("");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return;
        onSubmit(reason.trim());
      }}
    >
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("denyReasonPlaceholder")}
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          intent="danger"
          size="sm"
          disabled={pending || !reason.trim()}
        >
          {t("actions.confirmDeny")}
        </Button>
        <Button
          type="button"
          intent="neutral"
          tone="ghost"
          size="sm"
          onClick={onCancel}
        >
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}

// ── Edit form (reuses the invite form's GuestBlock, pre-filled) ─────────────

function guestFromDetail(d: VisitRequestDetail): GuestEntry {
  // parsePhone tolerates legacy dirty values (spaces, doubled country codes) so
  // editing an old request splits cleanly instead of re-doubling on save.
  const { code: phoneCode, number: phoneNumber } = parsePhone(
    d.visitor.phone,
    DIAL_CODES,
  );
  const sched = d.scheduledAt ? new Date(d.scheduledAt) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    ...blankGuest(),
    id: d.id,
    fullName: d.visitor.fullName,
    email: d.visitor.email,
    organization: d.visitor.organization ?? "",
    phoneCode,
    phoneNumber,
    hostUserId: d.host?.user.id ?? "",
    floor: d.floor ?? "",
    purpose: d.purpose,
    scheduledDate: sched
      ? `${sched.getFullYear()}-${pad(sched.getMonth() + 1)}-${pad(sched.getDate())}`
      : "",
    scheduledTime: sched
      ? `${pad(sched.getHours())}:${pad(sched.getMinutes())}`
      : "",
    useSame: false,
  };
}

function EditVisitForm({
  detail,
  onDone,
}: {
  detail: VisitRequestDetail;
  onDone: () => void;
}) {
  const t = useTranslations("requests");
  const hosts = useHosts();
  const update = useUpdateVisit(detail.id);
  const [guest, setGuest] = React.useState<GuestEntry>(() =>
    guestFromDetail(detail),
  );

  const save = () => {
    const scheduledAt = scheduledAtOf(guest);
    update.mutate(
      {
        fullName: guest.fullName.trim(),
        email: guest.email.trim(),
        phone: formatPhone(guest) || undefined,
        organization: guest.organization.trim() || undefined,
        hostUserId: guest.hostUserId || undefined,
        floor: guest.floor || undefined,
        purpose: guest.purpose || undefined,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : undefined,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <GuestBlock
        value={guest}
        index={0}
        mode="invite"
        hosts={hosts.data ?? []}
        onUseSameChange={() => {}}
        showErrors={false}
        onChange={(patch) => setGuest((g) => ({ ...g, ...patch }))}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={update.isPending}>
          {t("actions.save")}
        </Button>
        <Button
          intent="neutral"
          tone="ghost"
          size="sm"
          onClick={onDone}
          disabled={update.isPending}
        >
          {t("actions.cancel")}
        </Button>
      </div>
    </div>
  );
}

// ── Notification context (opened from the Updates feed) ────────────────────

/**
 * When the detail sheet is opened from an activity-feed item, it shows a colored
 * banner describing the update and swaps the QR panel for a destination card.
 */
export interface NotificationContext {
  category: StaffActivityCategory;
  title: string;
  body: string;
  createdAt: string;
}

function NotificationBanner({ ctx }: { ctx: NotificationContext }) {
  const tCat = useTranslations("staff.updates");
  const format = useFormatter();
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-emphasis p-4 text-emphasis-fg">
      <div className="flex items-center justify-between gap-2">
        <Badge
          intent="neutral"
          tone="soft"
          className="bg-surface/15 text-emphasis-fg"
        >
          {tCat(`category.${ctx.category}`)}
        </Badge>
        <span className="text-xs text-emphasis-muted">
          {format.relativeTime(new Date(ctx.createdAt))}
        </span>
      </div>
      <p className="text-lg font-semibold text-accent">{ctx.title}</p>
      <p className="text-sm text-emphasis-muted">{ctx.body}</p>
    </div>
  );
}

/** The gold destination card shown beside the progress stepper in feed context. */
function DestinationCard({ floor }: { floor?: string | null }) {
  const t = useTranslations("requests");
  if (!floor) return null;
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="flex size-28 items-center justify-center rounded-md bg-accent p-3 text-center text-sm font-bold text-accent-fg">
        {floor}
      </div>
      <span className="text-xs uppercase tracking-wide text-fg-subtle">
        {t("sections.destination")}
      </span>
    </div>
  );
}

/** Star rating shown after checkout — persists the host's score for the guest. */
function RateGuest({ visitId }: { visitId: string }) {
  const t = useTranslations("requests");
  const rate = useRateVisit(visitId);
  const [rating, setRating] = React.useState(0);
  const submit = (score: number) => {
    setRating(score);
    rate.mutate({ score });
  };
  return (
    <DetailSection title={t("sections.rateGuest")}>
      <div className="flex items-center justify-center gap-2 py-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => submit(n)}
            disabled={rate.isPending}
            aria-label={String(n)}
          >
            <Star
              className={`size-7 ${
                n <= rating
                  ? "fill-primary text-primary"
                  : "fill-transparent text-border"
              }`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </DetailSection>
  );
}

// ── Request detail ──────────────────────────────────────────────────────────

function RequestDetailBody({
  data,
  onClose,
  notification,
}: {
  data: VisitRequestDetail;
  onClose: () => void;
  notification?: NotificationContext;
}) {
  const t = useTranslations("requests");
  const format = useFormatter();
  const { hasPermission, user } = useAuth();
  const [showDeny, setShowDeny] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [checkAction, setCheckAction] = React.useState<"in" | "out" | null>(
    null,
  );
  const cancel = useCancelVisit(data.id);
  const approve = useApproveVisit(data.id);
  const deny = useDenyVisit(data.id);
  const resubmit = useResubmitVisit(data.id);

  const isMine = data.createdById === user?.id;
  const isPending = data.status === "PENDING";
  const preApproval =
    data.status === "PENDING" || data.status === "NEEDS_MORE_INFO";
  const isTerminal = TERMINAL.includes(data.status);

  const canApprove = isPending && hasPermission("visit:approve");
  const canDeny = isPending && hasPermission("visit:deny");
  const canResubmit =
    data.status === "NEEDS_MORE_INFO" && data.host?.user.id === user?.id;
  // Cancel only for the VMC operator who created it, while it isn't terminal.
  const canCancel = data.source === "VMC_STATION" && isMine && !isTerminal;
  // Edit only the creator, and only before a CSO approves it.
  const canEdit = isMine && preApproval;
  // The staff host viewing their own visit gets the clean guest-first layout
  // (no host card); VMC/admin viewers still see the requesting host.
  const viewerIsHost = data.host?.user.id === user?.id;
  const onsite = data.status === "CHECKED_IN";
  const checkedOut = data.status === "CHECKED_OUT";

  const stepLabels = {
    awaitingCso: t("timeline.awaitingCso"),
    checkedIn: t("timeline.checkedIn"),
    passIssued: t("timeline.issuedPass"),
    checkedOut: t("timeline.checkedOut"),
  };

  const canCheckIn =
    data.status === "APPROVED" && hasPermission("visit:check_in");
  const canCheckOut =
    data.status === "CHECKED_IN" && hasPermission("visit:check_out");
  const hasActions =
    canResubmit ||
    canApprove ||
    canDeny ||
    canCancel ||
    canEdit ||
    canCheckIn ||
    canCheckOut;

  const footer =
    editing || !hasActions ? undefined : (
    <>
      {canResubmit ? (
        <Button
          intent="primary"
          size="sm"
          onClick={() => resubmit.mutate({})}
          disabled={resubmit.isPending}
        >
          {t("actions.resubmit")}
        </Button>
      ) : null}
      {canApprove ? (
        <Button
          intent="success"
          size="sm"
          onClick={() => approve.mutate()}
          disabled={approve.isPending}
        >
          {t("actions.approve")}
        </Button>
      ) : null}
      {canDeny ? (
        <Button
          intent="danger"
          tone="outline"
          size="sm"
          onClick={() => setShowDeny((s) => !s)}
          disabled={deny.isPending}
        >
          {t("actions.deny")}
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          intent="danger"
          tone="outline"
          size="sm"
          onClick={() => cancel.mutate()}
          disabled={cancel.isPending}
        >
          {t("actions.cancelRequest")}
        </Button>
      ) : null}
      {canEdit ? (
        <Button intent="primary" size="sm" onClick={() => setEditing(true)}>
          {t("actions.editRequest")}
        </Button>
      ) : null}
      {canCheckIn ? (
        <Button intent="primary" size="sm" onClick={() => setCheckAction("in")}>
          {t("actions.checkIn")}
        </Button>
      ) : null}
      {canCheckOut ? (
        <Button intent="danger" size="sm" onClick={() => setCheckAction("out")}>
          {t("actions.checkOut")}
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <DetailDrawer
        open
        side="start"
        onOpenChange={(o) => !o && onClose()}
        title={
          editing
            ? t("editTitle")
            : notification
              ? notification.category === "ARRIVAL_UPDATE"
                ? t("inviteRequestDetailTitle")
                : t("updateDetailTitle")
              : t("detailTitle")
        }
        footer={footer}
      >
        {editing ? (
          <EditVisitForm detail={data} onDone={() => setEditing(false)} />
        ) : (
          <>
            {notification ? <NotificationBanner ctx={notification} /> : null}
            {showDeny ? (
              <DetailSection title={t("actions.deny")}>
                <DenyForm
                  onSubmit={(reason) =>
                    deny.mutate(reason, {
                      onSuccess: () => setShowDeny(false),
                    })
                  }
                  onCancel={() => setShowDeny(false)}
                  pending={deny.isPending}
                />
              </DetailSection>
            ) : null}
            <DetailSection title={t("sections.visitorInfo")}>
              <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={data.visitor.fullName} size="md" />
                  <div className="flex flex-col">
                    <span className="font-medium text-fg">
                      {data.visitor.fullName}
                    </span>
                    {data.visitor.organization ? (
                      <span className="text-sm text-fg-muted">
                        {data.visitor.organization}
                      </span>
                    ) : null}
                    <span className="text-sm text-fg-muted">
                      {data.visitor.email}
                      {data.visitor.phone ? ` · ${data.visitor.phone}` : ""}
                    </span>
                  </div>
                </div>
                <StatusPill status={data.status} />
              </div>
            </DetailSection>

            <DetailSection title={t("sections.trackStatus")}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Timeline
                    steps={timelineFor(data.status, stepLabels, !!data.pass)}
                  />
                </div>
                {notification ? (
                  <DestinationCard floor={data.floor} />
                ) : (
                  <QrPanel
                    visitId={data.id}
                    qrCode={data.qrCode}
                    referenceCode={data.referenceCode}
                  />
                )}
              </div>
            </DetailSection>

            <DetailSection title={t("sections.visitSummary")}>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("sections.purposeCategory")}>
                  <Badge intent="neutral" tone="soft">
                    {data.purpose}
                  </Badge>
                </Field>
                {checkedOut && data.checkInAt && data.checkOutAt ? (
                  <Field label={t("sections.timeSpentOnsite")}>
                    {`${durationHms(data.checkInAt, data.checkOutAt)} HR`}
                  </Field>
                ) : data.scheduledAt ? (
                  <Field label={t("sections.scheduledFor")}>
                    {format.dateTime(new Date(data.scheduledAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Field>
                ) : null}
                {(onsite || checkedOut) && data.checkInAt ? (
                  <Field
                    label={
                      checkedOut
                        ? t("sections.checkInTime")
                        : t("sections.checkInDateTime")
                    }
                  >
                    {format.dateTime(new Date(data.checkInAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Field>
                ) : null}
                {checkedOut && data.checkOutAt ? (
                  <Field label={t("sections.checkOutDateTime")}>
                    {format.dateTime(new Date(data.checkOutAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Field>
                ) : null}
                {onsite || checkedOut ? (
                  <Field label={t("sections.checkedInBy")}>
                    {data.checkedInByName ?? "—"}
                  </Field>
                ) : null}
                <Field label={t("sections.visitingFloor")}>
                  {data.floor ?? "—"}
                </Field>
                <Field label={t("sections.guestPass")}>
                  {data.pass?.cardNumber ? (
                    <span className="font-semibold text-warning">
                      {data.pass.cardNumber}
                    </span>
                  ) : (
                    t("notAssigned")
                  )}
                </Field>
                {data.host && !viewerIsHost ? (
                  <Field label={t("sections.host")}>
                    {data.host.user.fullName}
                  </Field>
                ) : null}
              </div>
            </DetailSection>

            {checkedOut ? <RateGuest visitId={data.id} /> : null}

            <DetailSection title={t("sections.visitNotes")}>
              <NoteList notes={data.notes} emptyLabel={t("noNotes")} />
              <NoteComposer target={{ visitId: data.id }} />
            </DetailSection>
          </>
        )}
      </DetailDrawer>

      {checkAction === "in" ? (
        <CheckInModal visitId={data.id} onClose={() => setCheckAction(null)} />
      ) : null}
      {checkAction === "out" ? (
        <CheckOutModal visitId={data.id} onClose={() => setCheckAction(null)} />
      ) : null}
    </>
  );
}

/** Small status badge on the visitor card (Expected / Onsite / Awaiting / …). */
function StatusPill({ status }: { status: VisitStatus }) {
  const t = useTranslations("requests");
  const intents: Record<
    VisitStatus,
    "warning" | "success" | "danger" | "neutral"
  > = {
    PENDING: "warning",
    NEEDS_MORE_INFO: "danger",
    APPROVED: "success",
    DENIED: "danger",
    CHECKED_IN: "success",
    CHECKED_OUT: "neutral",
    CANCELLED: "neutral",
    EXPIRED: "neutral",
  };
  return (
    <Badge intent={intents[status]} tone="soft">
      {t(`pill.${status}`)}
    </Badge>
  );
}

// ── Alert detail ──────────────────────────────────────────────────────────

const LEVEL_DOT: Record<string, string> = {
  LOW: "bg-success",
  MEDIUM: "bg-warning",
  HIGH: "bg-danger",
  CRITICAL: "bg-danger",
};

function AlertDetailBody({
  data,
  onClose,
  notification,
}: {
  data: AlertDetail;
  onClose: () => void;
  notification?: NotificationContext;
}) {
  const t = useTranslations("requests");
  const format = useFormatter();

  return (
    <DetailDrawer
      open
      side="start"
      onOpenChange={(o) => !o && onClose()}
      title={notification ? t("updateDetailTitle") : t("alertDetailTitle")}
    >
      {notification ? <NotificationBanner ctx={notification} /> : null}
      <div className="flex items-start gap-2 rounded-lg bg-danger-subtle p-3 text-sm font-medium text-danger">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t("alertBanner")}</span>
      </div>

      {data.visitor ? (
        <DetailSection title={t("sections.visitorInfo")}>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted p-4">
            <div className="flex items-center gap-3">
              <Avatar name={data.visitor.fullName} size="md" />
              <div className="flex flex-col">
                <span className="font-medium text-fg">
                  {data.visitor.fullName}
                </span>
                {data.visitor.organization ? (
                  <span className="text-sm text-fg-muted">
                    {data.visitor.organization}
                  </span>
                ) : null}
                <span className="text-sm text-fg-muted">
                  {data.visitor.email}
                  {data.visitor.phone ? ` · ${data.visitor.phone}` : ""}
                </span>
              </div>
            </div>
            <Badge intent="danger" tone="soft">
              {t("alertNeedsAttention")}
            </Badge>
          </div>
        </DetailSection>
      ) : null}

      {data.visit ? (
        <DetailSection title={t("sections.requestingHost")}>
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-emphasis p-4 text-sm text-emphasis-fg">
            <Meta
              label={t("sections.requestedBy")}
              value={data.visit.hostName}
            />
            <Meta label={t("sections.staffRole")} value={data.visit.hostUnit} />
            <Meta
              label={t("sections.scheduled")}
              value={
                data.visit.scheduledAt
                  ? format.dateTime(new Date(data.visit.scheduledAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : null
              }
            />
            <Meta label={t("sections.floor")} value={data.visit.floor} />
          </div>
        </DetailSection>
      ) : null}

      <DetailSection title={t("sections.alertSummary")}>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-fg-subtle">
              {t("sections.riskLevel")}
            </span>
            <span className="flex items-center gap-2 font-semibold text-fg">
              <span
                className={`size-2 rounded-full ${LEVEL_DOT[data.level] ?? "bg-fg-muted"}`}
                aria-hidden="true"
              />
              {data.level}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-fg-subtle">
              {t("sections.alertCategory")}
            </span>
            <Badge intent="warning" tone="soft">
              {data.category ?? t("alertDefaultCategory")}
            </Badge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-fg-subtle">
              {t("sections.flaggedAt")}
            </span>
            <span className="text-fg">
              {format.dateTime(new Date(data.createdAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
        </div>
      </DetailSection>

      <DetailSection title={t("sections.alertReason")}>
        <div className="rounded-lg bg-danger-subtle p-4 text-sm text-fg">
          {data.reason}
        </div>
      </DetailSection>

      <DetailSection title={t("sections.remarks")}>
        <NoteList notes={data.notes} emptyLabel={t("noNotes")} />
        <NoteComposer
          target={{ alertId: data.id }}
          placeholder={t("respondPlaceholder")}
        />
      </DetailSection>
    </DetailDrawer>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-emphasis-muted">
        {label}
      </span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * The status-aware visit/alert detail sheet, opened from both the VMC table
 * (View Details) and the Requests & Alerts feed (card click).
 */
export function VisitDetailSheet({
  kind,
  id,
  onClose,
  notification,
}: {
  kind: "request" | "alert";
  id: string;
  onClose: () => void;
  /** Set when opened from the Updates feed — renders a contextual banner. */
  notification?: NotificationContext;
}) {
  const isRequest = kind === "request";
  const request = useVisitRequest(isRequest ? id : null);
  const alert = useAlert(isRequest ? null : id);

  if (isRequest) {
    if (request.isLoading || !request.data)
      return <LoadingDrawer onClose={onClose} />;
    return (
      <RequestDetailBody
        data={request.data}
        onClose={onClose}
        notification={notification}
      />
    );
  }
  if (alert.isLoading || !alert.data)
    return <LoadingDrawer onClose={onClose} />;
  return (
    <AlertDetailBody
      data={alert.data}
      onClose={onClose}
      notification={notification}
    />
  );
}

function LoadingDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("requests");
  return (
    <DetailDrawer
      open
      side="start"
      onOpenChange={(o) => !o && onClose()}
      title={t("detailTitle")}
    >
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    </DetailDrawer>
  );
}
