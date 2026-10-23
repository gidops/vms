import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../primitives/Button/Button";
import { cn } from "../../foundations/cn";

export interface PaginationProps {
  /** Current page (1-based). */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Pages to show on each side of the current page. */
  siblingCount?: number;
  className?: string;
}

type Item = number | "ellipsis-start" | "ellipsis-end";

function buildItems(
  page: number,
  totalPages: number,
  siblingCount: number,
): Item[] {
  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const left = Math.max(page - siblingCount, 1);
  const right = Math.min(page + siblingCount, totalPages);
  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < totalPages - 1;
  const items: Item[] = [1];
  if (showLeftEllipsis) items.push("ellipsis-start");
  for (
    let p = showLeftEllipsis ? left : 2;
    p <= (showRightEllipsis ? right : totalPages - 1);
    p++
  ) {
    items.push(p);
  }
  if (showRightEllipsis) items.push("ellipsis-end");
  items.push(totalPages);
  return items;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const items = buildItems(page, totalPages, siblingCount);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center gap-2", className)}
    >
      <Button
        intent="neutral"
        tone="ghost"
        size="sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="size-9 rounded-full border border-border p-0"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
      </Button>

      {items.map((item) =>
        typeof item === "number" ? (
          <Button
            key={item}
            intent="neutral"
            tone={item === page ? "solid" : "ghost"}
            size="sm"
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPageChange(item)}
            className={cn(
              "size-9 rounded-full p-0",
              item !== page && "border border-border",
            )}
          >
            {item}
          </Button>
        ) : (
          <span
            key={item}
            className="px-2 text-sm text-fg-subtle"
            aria-hidden="true"
          >
            …
          </span>
        ),
      )}

      <Button
        intent="neutral"
        tone="ghost"
        size="sm"
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="size-9 rounded-full border border-border p-0"
      >
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </Button>
    </nav>
  );
}
