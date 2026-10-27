"use client";

import { Button, FilterBar, SearchInput } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import {
  VisitFilters,
  type VisitFiltersValue,
} from "@/app/[locale]/staff/_components/VisitFilters";

export type { VisitFiltersValue };

export const EMPTY_FILTERS: VisitFiltersValue = {
  search: "",
  status: "all",
  type: "all",
  purpose: "all",
};

export interface AdminFiltersProps {
  variant?: "full" | "search";
  value: VisitFiltersValue;
  onChange: (patch: Partial<VisitFiltersValue>) => void;
  /** Flush the debounced search immediately (Search button / Enter). */
  onSearch: () => void;
}

export function AdminFilters({
  variant = "full",
  value,
  onChange,
  onSearch,
}: AdminFiltersProps) {
  const tDash = useTranslations("dashboard");

  if (variant === "full") {
    return (
      <VisitFilters value={value} onChange={onChange} onSearch={onSearch} />
    );
  }

  return (
    <FilterBar
      actions={<Button onClick={onSearch}>{tDash("filters.search")}</Button>}
    >
      <div className="min-w-56 flex-1">
        <SearchInput
          placeholder={tDash("filters.searchPlaceholder")}
          value={value.search}
          onChange={(e) => onChange({ search: e.target.value })}
          onClear={() => onChange({ search: "" })}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
        />
      </div>
    </FilterBar>
  );
}

/** Keystrokes are debounced into `search`; the Search button / Enter flushes immediately. */
export function useAdminFilters() {
  const [filters, setFilters] =
    React.useState<VisitFiltersValue>(EMPTY_FILTERS);
  const [search, setSearch] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(filters.search.trim()), 300);
    return () => clearTimeout(id);
  }, [filters.search]);

  return {
    filters,
    onChange: (patch: Partial<VisitFiltersValue>) =>
      setFilters((f) => ({ ...f, ...patch })),
    onSearch: () => setSearch(filters.search.trim()),
    query: {
      search: search || undefined,
      status: filters.status === "all" ? undefined : filters.status,
      type: filters.type === "all" ? undefined : filters.type,
      purpose: filters.purpose === "all" ? undefined : filters.purpose,
    },
  };
}
