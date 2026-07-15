import { Button } from "@vms/ui";
import { parsePhone } from "@vms/contracts";
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
    useSame: false,
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
