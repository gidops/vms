"use client";

import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  DrawerClose,
} from "@vms/ui";
import { Download, UserMinus, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useHosts } from "@/data/hosts/queries";
import { useCreateVisits } from "@/data/requests/queries";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import { ConfirmStep } from "./ConfirmStep";
import { GuestBlock } from "./GuestBlock";
import { SuccessStep } from "./SuccessStep";
import { VisitorPager } from "./VisitorPager";
import { downloadGuestTemplate, parseGuestsCsv } from "./csv";
import {
  blankGuest,
  buildCreateInput,
  groupNameValid,
  guestComplete,
  visitDetailFields,
  type GuestEntry,
  type VisitFormMode,
} from "./guest-form";

export type { VisitFormMode } from "./guest-form";

type View = "form" | "confirm" | "success";

export function VisitRequestForm({
  mode,
  onClose,
  fixedHostUserId,
  fixedHostName,
  onRequestCheckIn,
  onRequestCheckInSingle,
}: {
  mode: VisitFormMode;
  onClose: () => void;
  /** When set, the host is pinned to this user (a staff self-invite). */
  fixedHostUserId?: string;
  fixedHostName?: string;
  onRequestCheckIn?: (groupId: string) => void;
  onRequestCheckInSingle?: (visitId: string) => void;
}) {
  const t = useTranslations("invite");
  const hosts = useHosts();
  const create = useCreateVisits();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [view, setView] = React.useState<View>("form");
  const [showErrors, setShowErrors] = React.useState(false);
  const [created, setCreated] = React.useState<VisitRequestDetail[] | null>(
    null,
  );
  const [guests, setGuests] = React.useState<GuestEntry[]>(() => {
    const g = blankGuest();
    if (fixedHostUserId) g.hostUserId = fixedHostUserId;
    return [g];
  });
  // One guest is edited at a time; all their data lives in `guests`.
  const [active, setActive] = React.useState(0);

  // The group checkbox only appears with 2+ guests, so a group always has a peer.
  const [isGroupVisit, setIsGroupVisit] = React.useState(false);
  const [groupName, setGroupName] = React.useState("");
  const [groupContact, setGroupContact] = React.useState("");
  const group = { isGroupVisit, groupName, groupContact };

  const resetGroup = () => {
    setIsGroupVisit(false);
    setGroupName("");
    setGroupContact("");
  };

  const toggleGroup = (checked: boolean) => {
    if (!checked) {
      resetGroup();
      return;
    }
    setIsGroupVisit(true);
    // A group shares one set of visit details: copy the first guest's onto all.
    setGuests((prev) =>
      prev.map((g) => ({ ...g, ...visitDetailFields(prev[0]), useSame: true })),
    );
  };

  const hostList = hosts.data ?? [];

  const formValid =
    guests.every((g) => guestComplete(g, mode)) && groupNameValid(group);

  const patchGuest = (i: number, patch: Partial<GuestEntry>) =>
    setGuests((prev) =>
      prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)),
    );

  // The new guest inherits the last guest's "Use same visit details" choice.
  const addGuest = () => {
    setGuests((prev) => {
      const prevLast = prev[prev.length - 1];
      const g = blankGuest();
      if (prevLast.useSame) {
        Object.assign(g, visitDetailFields(prevLast), { useSame: true });
      } else {
        g.useSame = false;
        if (fixedHostUserId) g.hostUserId = fixedHostUserId;
      }
      return [...prev, g];
    });
    setActive(guests.length);
  };

  // Unchecking leaves the copied fields as-is.
  const setUseSameForActive = (checked: boolean) =>
    setGuests((prev) =>
      prev.map((g, idx) => {
        if (idx !== active) return g;
        if (checked && active > 0) {
          return {
            ...g,
            ...visitDetailFields(prev[active - 1]),
            useSame: true,
          };
        }
        return { ...g, useSame: checked };
      }),
    );

  const removeGuest = (i: number) => {
    setGuests((prev) => prev.filter((_, idx) => idx !== i));
    setActive((a) => Math.max(0, Math.min(a, guests.length - 2)));
    // The group checkbox hides with one guest, so don't leak group state into the payload.
    if (guests.length - 1 <= 1) resetGroup();
  };

  async function onImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const rows = await parseGuestsCsv(file);
      if (rows.length === 0) return;
      setGuests(
        rows.map((r) => {
          const g = blankGuest();
          g.fullName = r.fullName;
          g.email = r.email;
          g.organization = r.organization;
          g.phoneNumber = r.phone;
          // Unchecked so the box isn't shown ticked over empty fields.
          g.useSame = false;
          const match = hostList.find(
            (h) => h.email.toLowerCase() === r.hostEmail.toLowerCase(),
          );
          if (match) g.hostUserId = match.userId;
          return g;
        }),
      );
      setActive(0);
      resetGroup();
    } catch {
      /* ignore malformed CSV; the user can re-import */
    }
  }

  function goToConfirm() {
    if (!formValid) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setView("confirm");
  }

  async function submit() {
    try {
      const result = await create.mutateAsync(
        buildCreateInput(guests, mode, group),
      );
      setCreated(result);
      setView("success");
    } catch {
      /* error surfaced via create.isError below */
    }
  }

  // Bulk walk-ins have no shared group, so they are checked in from the board.
  const created1 = created?.[0];
  const canImmediateCheckIn =
    mode === "walkin" &&
    !!created1 &&
    (isGroupVisit ? !!created1.groupId : created!.length === 1);
  const handleSuccessCheckIn = () => {
    if (isGroupVisit && created1?.groupId) onRequestCheckIn?.(created1.groupId);
    else if (created1) onRequestCheckInSingle?.(created1.id);
    onClose();
  };

  const headerSubtitle =
    mode === "walkin" ? t("subtitleWalkin") : t("subtitleInvite");
  const activeGuest = guests[active] ?? guests[0];
  // Also covers CSV-imported guests whose visit details are still blank.
  const currentGuestComplete = guestComplete(activeGuest, mode);

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border p-5 pe-12">
        <h2 className="text-xl font-semibold text-fg">
          {mode === "walkin" ? t("titleWalkin") : t("titleInvite")}
        </h2>
        <p className="text-sm text-fg-muted">{headerSubtitle}</p>
      </div>

      {mode === "invite" ? (
        <div className="flex gap-3 overflow-hidden bg-emphasis px-5 py-4 min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onImportCsv}
          />

          <Button
            type="button"
            intent="accent"
            tone="outline"
            fullWidth
            className="min-w-0 max-w-full"
            onClick={() => fileRef.current?.click()}
          >
            <UserPlus className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{t("importCsv")}</span>
          </Button>

          <Button
            type="button"
            intent="accent"
            tone="outline"
            fullWidth
            className="min-w-0 max-w-full"
            onClick={downloadGuestTemplate}
          >
            <Download className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{t("downloadTemplate")}</span>
          </Button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-5">
        {view === "form" ? (
          <div className="flex flex-col gap-6">
            {guests.length > 1 ? (
              <VisitorPager
                count={guests.length}
                current={active}
                onSelect={setActive}
              />
            ) : null}

            {guests.length > 1 ? (
              <label className="inline-flex cursor-pointer items-center gap-2 self-end text-sm font-medium text-primary underline">
                <Checkbox
                  checked={isGroupVisit}
                  onCheckedChange={(c) => toggleGroup(c === true)}
                />
                {t("groupVisit")}
              </label>
            ) : null}

            <GuestBlock
              key={activeGuest.id}
              value={activeGuest}
              index={active}
              mode={mode}
              hosts={hostList}
              onUseSameChange={setUseSameForActive}
              showErrors={showErrors}
              fixedHostName={fixedHostName}
              onChange={(patch) => patchGuest(active, patch)}
              isGroupVisit={isGroupVisit}
              groupName={groupName}
              groupContact={groupContact}
              onGroupNameChange={setGroupName}
              onGroupContactChange={setGroupContact}
            />

            {guests.length > 1 ? (
              <Button
                type="button"
                intent="danger"
                tone="ghost"
                fullWidth
                className="border border-dashed border-danger"
                onClick={() => removeGuest(active)}
              >
                <UserMinus className="size-4" aria-hidden="true" />
                {t("removeGuest")}
              </Button>
            ) : null}
            <Button
              type="button"
              intent="primary"
              tone="ghost"
              fullWidth
              className="border border-dashed border-primary"
              disabled={!currentGuestComplete}
              onClick={addGuest}
            >
              <UserPlus className="size-4" aria-hidden="true" />
              {t("addGuest")}
            </Button>
          </div>
        ) : null}

        {view === "confirm" ? (
          <ConfirmStep
            guests={guests}
            mode={mode}
            hosts={hostList}
            group={group}
            fixedHostName={fixedHostName}
          />
        ) : null}

        {view === "success" && created ? (
          <SuccessStep
            created={created}
            mode={mode}
            hideHost={!!fixedHostUserId}
            onCheckIn={canImmediateCheckIn ? handleSuccessCheckIn : undefined}
          />
        ) : null}

        {create.isError ? (
          <Alert intent="danger" className="mt-4">
            <AlertDescription>{t("submitError")}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      {view !== "success" ? (
        <div className="flex items-center gap-2 border-t border-border p-4">
          {view === "confirm" ? (
            <Button
              type="button"
              intent="neutral"
              tone="ghost"
              onClick={() => setView("form")}
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
            onClick={view === "form" ? goToConfirm : submit}
            disabled={create.isPending}
          >
            {create.isPending
              ? t("submitting")
              : view === "form" && mode === "walkin"
                ? t("submitWalkin")
                : t("submitInvite")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
