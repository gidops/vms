"use client";

import { Alert, AlertDescription, Button, Checkbox, DrawerClose } from "@vms/ui";
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
  guestDetailsValid,
  visitDetailFields,
  visitDetailsValid,
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
  /** Group walk-in success "Check-In Visitor" → open the group check-in sheet. */
  onRequestCheckIn?: (groupId: string) => void;
  /** Single walk-in success "Check-In Visitor" → open the single check-in modal. */
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
  // The visitor currently being edited (one guest is shown at a time; the pager
  // switches between them). Their data lives in `guests`, so navigating away and
  // back preserves everything.
  const [active, setActive] = React.useState(0);

  // Group visit: one shared group name/contact across all guests, and "use same
  // visit details" is forced on. A bulk submission keeps guests independent. The
  // checkbox only appears with 2+ guests (see below), so a group always has a peer.
  const [isGroupVisit, setIsGroupVisit] = React.useState(false);
  const [groupName, setGroupName] = React.useState("");
  const [groupContact, setGroupContact] = React.useState("");
  const group = { isGroupVisit, groupName, groupContact };

  // Clear all group state — used when the group is turned off and whenever the
  // guest set changes such that a group is no longer possible/meaningful.
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
    // A group shares one set of visit details — copy the first guest's details
    // onto every guest (covers typed, "Add Guest", and CSV-imported guests).
    setGuests((prev) =>
      prev.map((g) => ({ ...g, ...visitDetailFields(prev[0]), useSame: true })),
    );
  };

  const hostList = hosts.data ?? [];

  // Every guest now carries its own visit details, so all must be complete; a
  // group visit also needs a group name.
  const formValid =
    guests.every((g) => guestDetailsValid(g) && visitDetailsValid(g, mode)) &&
    groupNameValid(group);

  // ── Guest list helpers ──────────────────────────────────────────────────
  const patchGuest = (i: number, patch: Partial<GuestEntry>) =>
    setGuests((prev) =>
      prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)),
    );

  // "Add Guest" commits the current form (already in state) and swaps to a fresh
  // blank visitor; the new guest inherits the previous (last) guest's "Use same
  // visit details" choice — if set, its visit details are pre-copied.
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

  // "Use same visit details" toggle on a guest (index > 0): checking copies the
  // previous guest's visit details into this one immediately; unchecking just
  // clears the flag and leaves the fields as-is.
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
    // Back down to a single guest → a group is no longer possible; the checkbox
    // hides, so clear any group state rather than leak it into the payload.
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
          // Imported guests have no visit details yet — start unchecked so the
          // checkbox isn't shown ticked over empty fields.
          g.useSame = false;
          const match = hostList.find(
            (h) => h.email.toLowerCase() === r.hostEmail.toLowerCase(),
          );
          if (match) g.hostUserId = match.userId;
          return g;
        }),
      );
      setActive(0);
      // A fresh guest set replaces any prior group intent; re-check "Group visit"
      // (only shown for a multi-row import) to reapply shared details.
      resetGroup();
    } catch {
      /* ignore malformed CSV; the user can re-import */
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────
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

  // Walk-in success "Check-In Visitor": a group opens the group check-in sheet, a
  // lone visitor the single check-in modal. Bulk walk-ins have no shared group,
  // so they are checked in individually from the board (no button — see below).
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
  // Gate "Add Guest" on the visitor currently on screen being complete (guest +
  // visit details) — this also covers CSV-imported guests, whose visit details
  // still need filling in.
  const currentGuestComplete =
    guestDetailsValid(activeGuest) && visitDetailsValid(activeGuest, mode);

  return (
    <>
      {/* Header (white) */}
      <div className="flex flex-col gap-1 border-b border-border p-5 pe-12">
        <h2 className="text-xl font-semibold text-fg">
          {mode === "walkin" ? t("titleWalkin") : t("titleInvite")}
        </h2>
        <p className="text-sm text-fg-muted">{headerSubtitle}</p>
      </div>

      {/* CSV banner (invite only, dark green) */}
      {mode === "invite" ? (
        <div className="flex flex-col gap-3 bg-emphasis px-5 py-4 sm:flex-row">
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
            onClick={() => fileRef.current?.click()}
          >
            <UserPlus className="size-4" aria-hidden="true" />
            {t("importCsv")}
          </Button>
          <Button
            type="button"
            intent="accent"
            tone="outline"
            fullWidth
            onClick={downloadGuestTemplate}
          >
            <Download className="size-4" aria-hidden="true" />
            {t("downloadTemplate")}
          </Button>
        </div>
      ) : null}

      {/* Body (scrollable) */}
      <div className="flex-1 overflow-y-auto p-5">
        {view === "form" ? (
          <div className="flex flex-col gap-6">
            {/* Visitor pager — only once a second visitor exists */}
            {guests.length > 1 ? (
              <VisitorPager
                count={guests.length}
                current={active}
                onSelect={setActive}
              />
            ) : null}

            {/* Group visit is only possible once a second guest exists. */}
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
          />
        ) : null}

        {view === "success" && created ? (
          <SuccessStep
            created={created}
            mode={mode}
            onCheckIn={canImmediateCheckIn ? handleSuccessCheckIn : undefined}
          />
        ) : null}

        {create.isError ? (
          <Alert intent="danger" className="mt-4">
            <AlertDescription>{t("submitError")}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      {/* Footer (sticky) — hidden on the success screen */}
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
