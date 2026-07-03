"use client";

import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@vms/ui";
import { useTranslations } from "next-intl";
import { VisitRequestForm } from "./VisitRequestForm";

export type QuickActionMode = "walkin" | "invite";

/**
 * Slide-over sheet for the dashboard quick actions. Hosts the multi-step
 * Register Walk-In / New Invite Request form (same Drawer used by Requests).
 */
export function QuickActionSheet({
  mode,
  onClose,
  fixedHostUserId,
  fixedHostName,
  onRequestCheckIn,
  onRequestCheckInSingle,
}: {
  mode: QuickActionMode | null;
  onClose: () => void;
  /** Pin the host (e.g. a staff member inviting visitors to themselves). */
  fixedHostUserId?: string;
  fixedHostName?: string;
  /** Group walk-in success "Check-In Visitor" → open the group check-in sheet. */
  onRequestCheckIn?: (groupId: string) => void;
  /** Single walk-in success "Check-In Visitor" → open the single check-in modal. */
  onRequestCheckInSingle?: (visitId: string) => void;
}) {
  const t = useTranslations("invite");
  if (!mode) return null;

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent side="start" className="flex flex-col gap-0 p-0">
        {/* The visible heading lives in the form; this satisfies the dialog a11y title. */}
        <DrawerTitle className="sr-only">
          {mode === "walkin" ? t("titleWalkin") : t("titleInvite")}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          {mode === "walkin" ? t("subtitleWalkin") : t("subtitleInvite")}
        </DrawerDescription>
        <VisitRequestForm
          mode={mode}
          onClose={onClose}
          fixedHostUserId={fixedHostUserId}
          fixedHostName={fixedHostName}
          onRequestCheckIn={onRequestCheckIn}
          onRequestCheckInSingle={onRequestCheckInSingle}
        />
      </DrawerContent>
    </Drawer>
  );
}
