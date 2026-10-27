import { Avatar } from "@vms/ui";
import type { VisitListItem } from "@/data/visits/visits.api";

/** Visitor column shared by the VMC and staff tables (single vs group avatar). */
export function VisitorCell({ row }: { row: VisitListItem }) {
  const isGroup = row.isGroupVisit && row.groupName;
  const name = isGroup ? row.groupName! : row.visitor.fullName;
  return (
    <span className="flex items-center gap-3">
      <Avatar
        name={name}
        size="md"
        accent={row.isGroupVisit ? "group" : "single"}
      />
      <span className="flex flex-col">
        <span className="font-medium text-fg">{name}</span>
        <span className="text-xs text-fg-muted">
          {isGroup ? (row.groupContact ?? "") : row.visitor.email}
        </span>
      </span>
    </span>
  );
}
