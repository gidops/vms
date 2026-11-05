"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useAvailableCards } from "@/data/access-cards/queries";
import { passesForFloor } from "./pass-floor";

/**
 * Lifts the selected badge id so the parent can gate Complete on a selection.
 * Lists only passes for the visit's floor, or every pass (with a note) when
 * none serve it.
 */
export function AssignPass({
  value,
  onChange,
  floor,
}: {
  value: string;
  onChange: (cardId: string) => void;
  floor?: string | null;
}) {
  const t = useTranslations("checkin");
  const cards = useAvailableCards();
  const { cards: list, fallback } = passesForFloor(cards.data ?? [], floor);
  const selected = list.find((c) => c.id === value);

  return (
    <div className="flex flex-col gap-1.5">
      {/* The box carries the focus border (as for text fields), also while the list is open. */}
      <div className="flex items-stretch overflow-hidden rounded-lg border border-primary transition-colors focus-within:border-[var(--color-ring)] has-[[data-state=open]]:border-[var(--color-ring)]">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1 rounded-none border-0 font-semibold text-primary">
            <SelectValue placeholder={t("assignPass")} />
          </SelectTrigger>
          <SelectContent>
            {list.length === 0 ? (
              <div className="px-3 py-2 text-sm text-fg-muted">
                {t("noCards")}
              </div>
            ) : null}
            {list.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.zone} · {c.cardNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex w-28 items-center justify-center border-s border-border bg-surface-muted text-lg font-bold tracking-[0.2em] text-fg">
          {selected ? selected.cardNumber : "0000"}
        </div>
      </div>
      {fallback ? (
        <p className="text-xs text-fg-muted">{t("noFloorCards")}</p>
      ) : null}
    </div>
  );
}
