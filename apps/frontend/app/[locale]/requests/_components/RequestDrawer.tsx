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
import { Hash } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import type { VisitNote, VisitRequestDetail } from "@/data/visits/visits.api";
import type { AlertDetail } from "@/data/alerts/alerts.api";
import {
  useAddNote,
  useAlert,
  useApproveVisit,
  useCancelVisit,
  useDenyVisit,
  useResubmitVisit,
  useVisitRequest,
} from "@/data/requests/queries";
import { useAuth } from "@/shared/auth/AuthContext";

export interface SelectedItem {
  kind: "request" | "alert";
  id: string;
}

/** Derive the 5-step lifecycle states from a visit status. */
function timelineFor(
  status: VisitRequestDetail["status"],
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
  onDone,
}: {
  target: { visitId?: string; alertId?: string };
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
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("addNotePlaceholder")}
        rows={3}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
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
  const cancel = useCancelVisit(data.id);
  const approve = useApproveVisit(data.id);
  const deny = useDenyVisit(data.id);
  const resubmit = useResubmitVisit(data.id);

  const isPending = data.status === "PENDING";
  const canApprove = isPending && hasPermission("visit:approve");
  const canDeny = isPending && hasPermission("visit:deny");
  // The host can resubmit their own request once the CSO bounced it back.
  const canResubmit =
    data.status === "NEEDS_MORE_INFO" && data.host.user.id === user?.id;

  const stepLabels = {
    inviteCreated: t("timeline.inviteCreated"),
    awaitingApproval: t("timeline.awaitingApproval"),
    checkedIn: t("timeline.checkedIn"),
    passIssued: t("timeline.passIssued"),
    checkedOut: t("timeline.checkedOut"),
  };

  return (
    <DetailDrawer
      open
      side="start"
      onOpenChange={(o) => !o && onClose()}
      title={t("detailTitle")}
      footer={
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
          <Button
            intent="danger"
            tone="outline"
            size="sm"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending || data.status === "CANCELLED"}
          >
            {t("actions.cancelRequest")}
          </Button>
          <Button
            intent="primary"
            tone="soft"
            size="sm"
            onClick={() => setShowNote(true)}
          >
            {t("actions.addNote")}
          </Button>
        </>
      }
    >
      {showDeny ? (
        <DetailSection title={t("actions.deny")}>
          <DenyForm
            onSubmit={(reason) =>
              deny.mutate(reason, { onSuccess: () => setShowDeny(false) })
            }
            onCancel={() => setShowDeny(false)}
            pending={deny.isPending}
          />
        </DetailSection>
      ) : null}
      <DetailSection title={t("sections.hostDetails")}>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-emphasis p-4 text-emphasis-fg">
          <div className="flex items-center gap-3">
            <Avatar name={data.host.user.fullName} size="md" />
            <div className="flex flex-col">
              <span className="font-semibold">{data.host.user.fullName}</span>
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
            <span className="font-medium text-fg">{t("sections.floor")}:</span>
            <span className="font-semibold text-warning">
              {data.host.office}
            </span>
          </div>
        ) : null}
      </DetailSection>

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
          <Badge intent="warning" tone="soft">
            {t("visitorAwaiting")}
          </Badge>
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
            onDone={() => setShowNote(false)}
          />
        ) : null}
      </DetailSection>
    </DetailDrawer>
  );
}

function AlertDetailBody({
  data,
  onClose,
}: {
  data: AlertDetail;
  onClose: () => void;
}) {
  const t = useTranslations("requests");
  const [showNote, setShowNote] = React.useState(false);

  return (
    <DetailDrawer
      open
      side="start"
      onOpenChange={(o) => !o && onClose()}
      title={t("alertDetailTitle")}
      footer={
        <Button
          intent="primary"
          tone="soft"
          size="sm"
          onClick={() => setShowNote(true)}
        >
          {t("actions.addNote")}
        </Button>
      }
    >
      <DetailSection title={t("sections.reason")}>
        <div className="rounded-lg bg-danger-subtle p-4 text-sm text-fg">
          {data.reason}
        </div>
      </DetailSection>

      {data.visitor ? (
        <DetailSection title={t("sections.visitorInfo")}>
          <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-4">
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
              </span>
            </div>
          </div>
        </DetailSection>
      ) : null}

      <DetailSection title={t("sections.remarks")}>
        <NoteList notes={data.notes} emptyLabel={t("noNotes")} />
        {showNote ? (
          <AddNoteForm
            target={{ alertId: data.id }}
            onDone={() => setShowNote(false)}
          />
        ) : null}
      </DetailSection>
    </DetailDrawer>
  );
}

export function RequestDrawer({
  selected,
  onClose,
}: {
  selected: SelectedItem | null;
  onClose: () => void;
}) {
  const isRequest = selected?.kind === "request";
  const isAlert = selected?.kind === "alert";
  const request = useVisitRequest(isRequest ? selected.id : null);
  const alert = useAlert(isAlert ? selected.id : null);

  if (!selected) return null;

  if (isRequest) {
    if (request.isLoading || !request.data) {
      return <LoadingDrawer onClose={onClose} />;
    }
    return <RequestDetailBody data={request.data} onClose={onClose} />;
  }

  if (alert.isLoading || !alert.data) {
    return <LoadingDrawer onClose={onClose} />;
  }
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
