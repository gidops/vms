"use client";

import { PERMISSIONS } from "@vms/contracts";
import * as React from "react";
import { VisitDetailSheet } from "@/app/[locale]/_components/VisitDetailSheet";
import { GroupApprovalSheet } from "@/app/[locale]/requests/_components/GroupApprovalSheet";
import type { VisitListItem } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";

type Selected = {
  kind: "request" | "alert";
  id: string;
  /** Open the sheet with the Deny reason form already expanded. */
  form?: "deny" | null;
};

/**
 * Detail-sheet state shared by the v2 screens. A pending group visit opens the
 * per-guest `GroupApprovalSheet` for approvers (as the old approval queue did);
 * everything else opens the shared `VisitDetailSheet`.
 */
export function useVisitOverlays() {
  const { hasPermission } = useAuth();
  const [selected, setSelected] = React.useState<Selected | null>(null);
  const [groupId, setGroupId] = React.useState<string | null>(null);

  const openRow = (row: VisitListItem) => {
    if (
      row.isGroupVisit &&
      row.groupId &&
      row.status === "PENDING" &&
      hasPermission(PERMISSIONS.VISIT_APPROVE)
    )
      setGroupId(row.groupId);
    else setSelected({ kind: "request", id: row.id });
  };

  /** Deny from a row: the visit's sheet with its reason form open. */
  const denyRow = (row: VisitListItem) =>
    setSelected({ kind: "request", id: row.id, form: "deny" });

  const overlays = (
    <>
      {selected ? (
        <VisitDetailSheet
          kind={selected.kind}
          id={selected.id}
          initialForm={selected.form ?? null}
          onClose={() => setSelected(null)}
        />
      ) : null}
      {groupId ? (
        <GroupApprovalSheet
          groupId={groupId}
          onClose={() => setGroupId(null)}
        />
      ) : null}
    </>
  );

  return { openRow, denyRow, open: setSelected, overlays };
}
