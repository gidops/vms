"use client";

import { Drawer, DrawerContent, DrawerTitle } from "@vms/ui";
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
}: {
  mode: QuickActionMode | null;
  onClose: () => void;
  /** Pin the host (e.g. a staff member inviting visitors to themselves). */
  fixedHostUserId?: string;
  fixedHostName?: string;
}) {
  const t = useTranslations("invite");
  if (!mode) return null;

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent
        side="start"
        className="flex max-w-xl flex-col gap-0 p-0 sm:max-w-2xl"
      >
        {/* The visible heading lives in the form; this satisfies the dialog a11y title. */}
        <DrawerTitle className="sr-only">
          {mode === "walkin" ? t("titleWalkin") : t("titleInvite")}
        </DrawerTitle>
        <VisitRequestForm
          mode={mode}
          onClose={onClose}
          fixedHostUserId={fixedHostUserId}
          fixedHostName={fixedHostName}
        />
      </DrawerContent>
    </Drawer>
  );
}
