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
import { Hash, TriangleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
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
import { useHosts } from "@/data/hosts/queries";
import {
  useAddNote,
  useAlert,
  useApproveVisit,
  useCancelVisit,
  useDenyVisit,
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

/** Derive the 5-step lifecycle states from a visit status. */
function timelineFor(
  status: VisitStatus,
  labels: Record<string, string>,
): TimelineStep[] {
  const order = [
    "inviteCreated",
    "awaitingApproval",
    "checkedIn",
    "passIssued",
    "checkedOut",
  ] as const;
  const progress: Record<string, number> = {
    PENDING: 1,
    NEEDS_MORE_INFO: 1,
    DENIED: 1,
    CANCELLED: 1,
    EXPIRED: 1,
    APPROVED: 2,
    CHECKED_IN: 3,
    CHECKED_OUT: 5,
  };
  const p = progress[status] ?? 1;
  return order.map((key, i) => ({
    key,
    label: labels[key] ?? key,
    state: i < p ? "complete" : i === p ? "current" : "upcoming",
  }));
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

function AddNoteForm({
  target,
  placeholder,
  onDone,
}: {
  target: { visitId?: string; alertId?: string };
  placeholder: string;
  onDone: () => void;
}) {
  const t = useTranslations("requests");
  const [body, setBody] = React.useState("");
  const addNote = useAddNote(target);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        addNote.mutate(body.trim(), {
          onSuccess: () => {
            setBody("");
            onDone();
          },
        });
      }}
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={addNote.isPending}>
          {t("actions.save")}
        </Button>
        <Button
          type="button"
          intent="neutral"
          tone="ghost"
          size="sm"
          onClick={onDone}
        >
          {t("actions.cancel")}
        </Button>
      </div>
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

function splitPhone(phone?: string | null): {
  phoneCode: string;
  phoneNumber: string;
} {
  if (!phone) return { phoneCode: "+234", phoneNumber: "" };
  const m = phone.trim().match(/^(\+\d+)\s+(.*)$/);
  if (m) return { phoneCode: m[1]!, phoneNumber: m[2]! };
  return { phoneCode: "+234", phoneNumber: phone.trim() };
}

function guestFromDetail(d: VisitRequestDetail): GuestEntry {
  const { phoneCode, phoneNumber } = splitPhone(d.visitor.phone);
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

// ── Request detail ──────────────────────────────────────────────────────────

function RequestDetailBody({
  data,
  onClose,
}: {
  data: VisitRequestDetail;
  onClose: () => void;
}) {
  const t = useTranslations("requests");
  const format = useFormatter();
  const { hasPermission, user } = useAuth();
  const [showNote, setShowNote] = React.useState(false);
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
  const canCancel =
    data.source === "VMC_STATION" && isMine && !isTerminal;
  // Edit only the creator, and only before a CSO approves it.
  const canEdit = isMine && preApproval;

  const stepLabels = {
    inviteCreated: t("timeline.inviteCreated"),
    awaitingApproval: t("timeline.awaitingApproval"),
    checkedIn: t("timeline.checkedIn"),
    passIssued: t("timeline.passIssued"),
    checkedOut: t("timeline.checkedOut"),
  };

  const footer = editing ? undefined : (
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
      {data.status === "APPROVED" ? (
        <Button intent="success" size="sm" onClick={() => setCheckAction("in")}>
          {t("actions.checkIn")}
        </Button>
      ) : null}
      {data.status === "CHECKED_IN" ? (
        <Button intent="danger" size="sm" onClick={() => setCheckAction("out")}>
          {t("actions.checkOut")}
        </Button>
      ) : null}
      <Button
        intent="primary"
        tone="soft"
        size="sm"
        onClick={() => setShowNote(true)}
      >
        {t("actions.addNote")}
      </Button>
    </>
  );

  return (
    <>
      <DetailDrawer
        open
        side="start"
        onOpenChange={(o) => !o && onClose()}
        title={editing ? t("editTitle") : t("detailTitle")}
        footer={footer}
      >
        {editing ? (
          <EditVisitForm detail={data} onDone={() => setEditing(false)} />
        ) : (
          <>
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
            {data.host ? (
              <DetailSection title={t("sections.hostDetails")}>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-emphasis p-4 text-emphasis-fg">
                  <div className="flex items-center gap-3">
                    <Avatar name={data.host.user.fullName} size="md" />
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {data.host.user.fullName}
                      </span>
                      {data.host.department ? (
                        <span className="text-sm text-emphasis-muted">
                          {data.host.department}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/afreximbank.svg"
                    alt=""
                    className="size-8"
                    aria-hidden="true"
                  />
                </div>
                {data.host.office ? (
                  <div className="flex items-center gap-2 rounded-lg bg-warning-subtle px-4 py-2 text-sm">
                    <Hash className="size-4 text-fg-muted" aria-hidden="true" />
                    <span className="font-medium text-fg">
                      {t("sections.floor")}:
                    </span>
                    <span className="font-semibold text-warning">
                      {data.host.office}
                    </span>
                  </div>
                ) : null}
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
              <Timeline steps={timelineFor(data.status, stepLabels)} />
            </DetailSection>

            <DetailSection title={t("sections.purposeOfVisit")}>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-fg-subtle">
                    {t("sections.purposeCategory")}
                  </span>
                  <Badge intent="neutral" tone="soft">
                    {data.purpose}
                  </Badge>
                </div>
                {data.scheduledAt ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-fg-subtle">
                      {t("sections.scheduledFor")}
                    </span>
                    <span className="text-sm text-fg">
                      {format.dateTime(new Date(data.scheduledAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
            </DetailSection>

            <DetailSection title={t("sections.origin")}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-fg-subtle">
                    {t("sections.createdByLabel")}
                  </span>
                  <span className="text-fg">{data.createdByName ?? "—"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-fg-subtle">
                    {t("sections.timeCreated")}
                  </span>
                  <span className="text-fg">
                    {format.dateTime(new Date(data.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-fg-subtle">
                    {t("sections.source")}
                  </span>
                  <span className="text-fg">{data.source ?? "—"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-fg-subtle">
                    {t("sections.role")}
                  </span>
                  <Badge intent="warning" tone="soft">
                    {t("vmcReception")}
                  </Badge>
                </div>
              </div>
            </DetailSection>

            <DetailSection title={t("sections.remarks")}>
              <NoteList notes={data.notes} emptyLabel={t("noNotes")} />
              {showNote ? (
                <AddNoteForm
                  target={{ visitId: data.id }}
                  placeholder={t("addNotePlaceholder")}
                  onDone={() => setShowNote(false)}
                />
              ) : null}
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
}: {
  data: AlertDetail;
  onClose: () => void;
}) {
  const t = useTranslations("requests");
  const format = useFormatter();
  const [showNote, setShowNote] = React.useState(true);

  return (
    <DetailDrawer
      open
      side="start"
      onOpenChange={(o) => !o && onClose()}
      title={t("alertDetailTitle")}
    >
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
            <Meta label={t("sections.requestedBy")} value={data.visit.hostName} />
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
        {showNote ? (
          <AddNoteForm
            target={{ alertId: data.id }}
            placeholder={t("respondPlaceholder")}
            onDone={() => setShowNote(false)}
          />
        ) : null}
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
}: {
  kind: "request" | "alert";
  id: string;
  onClose: () => void;
}) {
  const isRequest = kind === "request";
  const request = useVisitRequest(isRequest ? id : null);
  const alert = useAlert(isRequest ? null : id);

  if (isRequest) {
    if (request.isLoading || !request.data)
      return <LoadingDrawer onClose={onClose} />;
    return <RequestDetailBody data={request.data} onClose={onClose} />;
  }
  if (alert.isLoading || !alert.data) return <LoadingDrawer onClose={onClose} />;
  return <AlertDetailBody data={alert.data} onClose={onClose} />;
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
