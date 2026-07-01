"use client";

import {
  VisitDetailSheet,
  type SelectedItem,
} from "@/app/[locale]/_components/VisitDetailSheet";

export type { SelectedItem };

/**
 * Backwards-compatible wrapper around the shared {@link VisitDetailSheet}. Older
 * screens (admin queue, staff schedule/visits) open the drawer with a
 * `selected` item; the canonical component now takes `{ kind, id }`.
 */
export function RequestDrawer({
  selected,
  onClose,
}: {
  selected: SelectedItem | null;
  onClose: () => void;
}) {
  if (!selected) return null;
  return (
    <VisitDetailSheet
      kind={selected.kind}
      id={selected.id}
      onClose={onClose}
    />
  );
}
