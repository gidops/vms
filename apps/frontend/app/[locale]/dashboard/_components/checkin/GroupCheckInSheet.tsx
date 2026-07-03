"use client";

import {
  Button,
  Checkbox,
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

// Guests still awaiting CSO approval cannot be checked in yet.
const NOT_APPROVED: VisitListItem["status"][] = ["PENDING", "NEEDS_MORE_INFO"];
const isApproved = (g: VisitListItem) => g.status === "APPROVED";
const isNotApproved = (g: VisitListItem) => NOT_APPROVED.includes(g.status);
const isSelectable = (g: VisitListItem) => isApproved(g) || isNotApproved(g);

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
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [queue, setQueue] = React.useState<string[]>([]);
  const checkedInRef = React.useRef(false);

  const guests = groupQ.data?.items ?? [];
  const done = guests.filter((g) => g.status === "CHECKED_IN").length;

  const selectableIds = guests.filter(isSelectable).map((g) => g.id);
  const selectedGuests = guests.filter((g) => selected.has(g.id));
  // "Check-In All" acts on the selection and is only valid when every selected
  // guest is approved — including one not-yet-approved guest disables it.
  const canCheckInAll =
    selectedGuests.length > 0 && selectedGuests.every(isApproved);

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selectableIds.some((id) => selected.has(id));
  const headerChecked: boolean | "indeterminate" = allSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(selectableIds) : new Set());

  const openSingle = (visitId: string, action: "in" | "out") => {
    setQueue([]);
    setActive({ visitId, action });
  };

  // Bulk check-in: walk the selected approved guests through the badge modal one
  // after another, advancing on each success.
  const startCheckInAll = () => {
    const ids = selectedGuests.filter(isApproved).map((g) => g.id);
    if (ids.length === 0) return;
    checkedInRef.current = false;
    setQueue(ids.slice(1));
    setActive({ visitId: ids[0]!, action: "in" });
  };

  const handleModalClose = () => {
    const advance = checkedInRef.current && active?.action === "in";
    checkedInRef.current = false;
    if (advance && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      setActive({ visitId: next!, action: "in" });
      return;
    }
    setQueue([]);
    setActive(null);
  };

  const rowAction = (g: VisitListItem) => {
    if (isApproved(g))
      return (
        <Button
          intent="primary"
          size="sm"
          onClick={() => openSingle(g.id, "in")}
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
          onClick={() => openSingle(g.id, "out")}
        >
          {t("checkOut")}
        </Button>
      );
    // Not-yet-approved guests cannot be checked in — disabled, clearly labelled.
    if (isNotApproved(g))
      return (
        <Button intent="primary" size="sm" disabled>
          {t("checkIn")}
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

          {selectableIds.length > 0 ? (
            <label className="flex items-center gap-2 border-b border-border px-5 py-2 text-xs font-medium text-fg-muted">
              <Checkbox
                checked={headerChecked}
                onCheckedChange={(v) => toggleAll(v === true)}
                aria-label={t("selectAll")}
              />
              {t("selectAll")}
            </label>
          ) : null}

          <div className="flex-1 overflow-y-auto">
            {groupQ.isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner />
              </div>
            ) : (
              guests.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 border-b border-border px-5 py-4"
                >
                  {isSelectable(g) ? (
                    <Checkbox
                      checked={selected.has(g.id)}
                      onCheckedChange={() => toggle(g.id)}
                      aria-label={g.visitor.fullName}
                    />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-medium text-fg">
                      {g.visitor.fullName}
                    </span>
                    <span className="text-xs text-fg-muted">
                      {g.visitor.email}
                      {g.visitor.phone ? ` · ${g.visitor.phone}` : ""}
                    </span>
                    <StatusBadge status={g.status} className="self-start" />
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
              disabled={!canCheckInAll}
              onClick={startCheckInAll}
            >
              {t("checkInAll")}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {active?.action === "in" ? (
        <CheckInModal
          key={active.visitId}
          visitId={active.visitId}
          onClose={handleModalClose}
          onCheckedIn={() => {
            checkedInRef.current = true;
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(active.visitId);
              return next;
            });
          }}
        />
      ) : null}
      {active?.action === "out" ? (
        <CheckOutModal visitId={active.visitId} onClose={handleModalClose} />
      ) : null}
    </>
  );
}
