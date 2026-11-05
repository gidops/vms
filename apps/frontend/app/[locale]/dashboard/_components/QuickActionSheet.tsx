"use client";

import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@vms/ui";
import { useTranslations } from "next-intl";
import { VisitRequestForm } from "./VisitRequestForm";

export type QuickActionMode = "walkin" | "invite";

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
  fixedHostUserId?: string;
  fixedHostName?: string;
  onRequestCheckIn?: (groupId: string) => void;
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
