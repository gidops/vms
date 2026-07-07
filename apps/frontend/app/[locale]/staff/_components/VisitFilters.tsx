"use client";

import type { VisitStatus, VisitType } from "@vms/contracts";
import { VISIT_PURPOSES } from "@vms/contracts";
import {
  Button,
  FilterBar,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vms/ui";
import { useTranslations } from "next-intl";

const STATUSES: VisitStatus[] = [
  "PENDING",
  "NEEDS_MORE_INFO",
  "APPROVED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "DENIED",
  "CANCELLED",
  "EXPIRED",
];

const TYPES: VisitType[] = ["PRE_INVITED", "WALK_IN", "APPOINTMENT"];

export interface VisitFiltersValue {
  search: string;
  status: VisitStatus | "all";
  type: VisitType | "all";
  purpose: string;
}

/**
 * The shared staff filter bar (search + status/type/purpose), used by both the
 * staff dashboard ("Expected Guests") and My Visits so the two stay in sync.
 * Controlled — the parent owns the filter state; `onChange` receives a partial
 * patch. Status/type/purpose narrow the query server-side; search is applied
 * client-side over the fetched page by the caller.
 */
export function VisitFilters({
  value,
  onChange,
}: {
  value: VisitFiltersValue;
  onChange: (patch: Partial<VisitFiltersValue>) => void;
}) {
  const t = useTranslations("staff");
  const tCommon = useTranslations("common");
  const tDash = useTranslations("dashboard");

  return (
    <FilterBar actions={<Button>{tDash("filters.search")}</Button>}>
      <div className="min-w-56 flex-1">
        <SearchInput
          value={value.search}
          onChange={(e) => onChange({ search: e.target.value })}
          onClear={() => onChange({ search: "" })}
          placeholder={t("filters.searchPlaceholder")}
        />
      </div>
      <Select
        value={value.status}
        onValueChange={(v) => onChange({ status: v as VisitStatus | "all" })}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{tCommon("allStatus")}</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`status.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value.type}
        onValueChange={(v) => onChange({ type: v as VisitType | "all" })}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{tDash("filters.allVisitTypes")}</SelectItem>
          {TYPES.map((ty) => (
            <SelectItem key={ty} value={ty}>
              {t(`visitType.${ty}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.purpose} onValueChange={(v) => onChange({ purpose: v })}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{tDash("filters.allPurpose")}</SelectItem>
          {VISIT_PURPOSES.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
