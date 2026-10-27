"use client";

import {
  VisitDetailSheet,
  type SelectedItem,
} from "@/app/[locale]/_components/VisitDetailSheet";

export type { SelectedItem };

/** Adapts a `selected` item to {@link VisitDetailSheet}'s `{ kind, id }`. */
export function RequestDrawer({
  selected,
  onClose,
}: {
  selected: SelectedItem | null;
  onClose: () => void;
}) {
  if (!selected) return null;
  return (
    <VisitDetailSheet kind={selected.kind} id={selected.id} onClose={onClose} />
  );
}
