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

/**
 * The "Assign pass" control from the check-in modal: a zone dropdown of available
 * badges glued to the selected badge's number. Selecting a badge lifts its id to
 * the parent (which gates the Complete button on a selection).
 */
export function AssignPass({
  value,
  onChange,
}: {
  value: string;
  onChange: (cardId: string) => void;
}) {
  const t = useTranslations("checkin");
  const cards = useAvailableCards();
  const list = cards.data ?? [];
  const selected = list.find((c) => c.id === value);

  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-primary">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1 rounded-none border-0 font-semibold text-primary focus-visible:ring-0">
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
  );
}
