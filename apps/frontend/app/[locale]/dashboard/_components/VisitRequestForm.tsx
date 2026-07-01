"use client";

import { Alert, AlertDescription, Button, DrawerClose } from "@vms/ui";
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
}: {
  mode: VisitFormMode;
  onClose: () => void;
  /** When set, the host is pinned to this user (a staff self-invite). */
  fixedHostUserId?: string;
  fixedHostName?: string;
  /** Walk-in success "Check-In Visitor" → open the group check-in for this group. */
  onRequestCheckIn?: (groupId: string) => void;
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

  const hostList = hosts.data ?? [];

  // Every guest now carries its own visit details, so all must be complete.
  const formValid = guests.every(
    (g) => guestDetailsValid(g) && visitDetailsValid(g, mode),
  );

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
      const result = await create.mutateAsync(buildCreateInput(guests, mode));
      setCreated(result);
      setView("success");
    } catch {
      /* error surfaced via create.isError below */
    }
  }

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
          <ConfirmStep guests={guests} mode={mode} hosts={hostList} />
        ) : null}

        {view === "success" && created ? (
          <SuccessStep
            created={created}
            mode={mode}
            onCheckIn={() => {
              const groupId = created[0]?.groupId;
              if (groupId) onRequestCheckIn?.(groupId);
              onClose();
            }}
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
