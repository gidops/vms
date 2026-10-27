"use client";

import { Button } from "@vms/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

/** Previous · "Page X of Y" · Next; renders nothing for a single page. */
export function InboxPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("requests.pagination");
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        intent="neutral"
        tone="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("prev")}
      </Button>
      <span className="text-sm text-fg-muted">
        {t("pageOf", { page, total: totalPages })}
      </span>
      <Button
        intent="neutral"
        tone="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        {t("next")}
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </Button>
    </div>
  );
}
