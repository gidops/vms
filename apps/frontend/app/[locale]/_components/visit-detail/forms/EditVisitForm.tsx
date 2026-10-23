import { Button } from "@vms/ui";
import { evacuationAssistIssues, parsePhone } from "@vms/contracts";
import { useTranslations } from "next-intl";
import * as React from "react";
import { DIAL_CODES } from "@/app/[locale]/_components/PhoneInput";
import { GuestBlock } from "@/app/[locale]/dashboard/_components/GuestBlock";
import {
  blankGuest,
  formatPhone,
  scheduledAtOf,
  type GuestEntry,
} from "@/app/[locale]/dashboard/_components/guest-form";
import { useHosts } from "@/data/hosts/queries";
import { useUpdateVisit } from "@/data/requests/queries";
import type { VisitRequestDetail } from "@/data/visits/visits.api";

/** Map a visit detail onto the invite form's guest shape for pre-filled editing. */
function guestFromDetail(d: VisitRequestDetail): GuestEntry {
  const { code: phoneCode, number: phoneNumber } = parsePhone(
    d.visitor.phone ?? "",
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
    needsEvacuationAssist: d.needsEvacuationAssist ?? null,
    evacuationAssistTypes: d.evacuationAssistTypes ?? [],
    evacuationAssistOther: d.evacuationAssistOther ?? "",
    commsConsent: d.commsConsent ?? null,
    useSame: false,
  };
}

/**
 * The evacuation fields to send: only when the answer changed, so editing a
 * visit's other details never re-validates an older answer (e.g. a "Yes" saved
 * before assistance types existed). A "Yes" carries its types; "No" clears them
 * server-side.
 */
function evacuationPatch(guest: GuestEntry, detail: VisitRequestDetail) {
  const answer = guest.needsEvacuationAssist;
  const types = guest.evacuationAssistTypes;
  const other = types.includes("OTHER")
    ? guest.evacuationAssistOther.trim()
    : "";
  const before = detail.evacuationAssistTypes ?? [];
  const changed =
    answer !== (detail.needsEvacuationAssist ?? null) ||
    types.length !== before.length ||
    types.some((t) => !before.includes(t)) ||
    other !== (detail.evacuationAssistOther ?? "");
  if (!changed || answer === null) return {};
  if (!answer) return { needsEvacuationAssist: false };
  return {
    needsEvacuationAssist: true,
    evacuationAssistTypes: types,
    evacuationAssistOther: other || undefined,
  };
}

/** Reception edit of a not-yet-approved request via the pre-filled invite form. */
export function EditVisitForm({
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

  const [showErrors, setShowErrors] = React.useState(false);

  const save = () => {
    const evacuation = evacuationPatch(guest, detail);
    if (
      evacuation.needsEvacuationAssist &&
      evacuationAssistIssues({
        needsEvacuationAssist: true,
        evacuationAssistTypes: evacuation.evacuationAssistTypes,
        evacuationAssistOther: evacuation.evacuationAssistOther,
      }).length > 0
    ) {
      // A new "Yes" needs its assistance type before it can be saved.
      setShowErrors(true);
      return;
    }
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
        ...evacuation,
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
        showErrors={showErrors}
        safety="evacuationOnly"
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
