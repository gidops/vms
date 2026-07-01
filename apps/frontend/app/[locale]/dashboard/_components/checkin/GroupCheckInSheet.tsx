"use client";

import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  Spinner,
  StatusBadge,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useVisitGroup } from "@/data/requests/queries";
import type { VisitListItem } from "@/data/visits/visits.api";
import { CheckInModal } from "./CheckInModal";
import { CheckOutModal } from "./CheckOutModal";

type Active = { visitId: string; action: "in" | "out" } | null;

export function GroupCheckInSheet({
  groupId,
  onClose,
}: {
  groupId: string;
  onClose: () => void;
}) {
  const t = useTranslations("checkin");
  const groupQ = useVisitGroup(groupId);
  const [active, setActive] = React.useState<Active>(null);

  const guests = groupQ.data?.items ?? [];
  const done = guests.filter((g) => g.status === "CHECKED_IN").length;
  const firstPending = guests.find((g) => g.status === "APPROVED");

  const rowAction = (g: VisitListItem) => {
    if (g.status === "APPROVED")
      return (
        <Button
          intent="primary"
          size="sm"
          onClick={() => setActive({ visitId: g.id, action: "in" })}
        >
          {t("checkIn")}
        </Button>
      );
    if (g.status === "CHECKED_IN")
      return (
        <Button
          intent="danger"
          tone="outline"
          size="sm"
          onClick={() => setActive({ visitId: g.id, action: "out" })}
        >
          {t("checkOut")}
        </Button>
      );
    return (
      <Button intent="neutral" tone="outline" size="sm" disabled>
        {t("viewDetails")}
      </Button>
    );
  };

  return (
    <>
      <Drawer open onOpenChange={(o) => !o && onClose()}>
        <DrawerContent
          side="start"
          className="flex max-w-xl flex-col gap-0 p-0"
        >
          <div className="flex items-center justify-between border-b border-border p-5 pe-12">
            <DrawerTitle className="text-xl font-semibold text-fg">
              {t("groupTitle")}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              {t("guestInformation")}
            </DrawerDescription>
          </div>

          <div className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="font-semibold text-primary">
              {t("guestInformation")}
            </span>
            <span className="text-fg-muted">
              {t("checkedInCount", { done, total: guests.length })}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {groupQ.isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner />
              </div>
            ) : (
              guests.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-fg">
                      {g.visitor.fullName}
                    </span>
                    <span className="text-xs text-fg-muted">
                      {g.visitor.email}
                      {g.visitor.phone ? ` · ${g.visitor.phone}` : ""}
                    </span>
                    <StatusBadge status={g.status} />
                  </div>
                  {rowAction(g)}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border p-4">
            <Button
              intent="primary"
              fullWidth
              disabled={!firstPending}
              onClick={() =>
                firstPending &&
                setActive({ visitId: firstPending.id, action: "in" })
              }
            >
              {t("checkInAll")}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {active?.action === "in" ? (
        <CheckInModal
          visitId={active.visitId}
          onClose={() => setActive(null)}
        />
      ) : null}
      {active?.action === "out" ? (
        <CheckOutModal
          visitId={active.visitId}
          onClose={() => setActive(null)}
        />
      ) : null}
    </>
  );
}
