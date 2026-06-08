import { ChevronRight } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  /** Render function for links (e.g. Next.js Link). Defaults to <a>. */
  renderLink?: (item: BreadcrumbItem, index: number) => React.ReactNode;
}

export function Breadcrumbs({
  items,
  renderLink,
  className,
  ...props
}: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={className} {...props}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-1.5"
            >
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    isLast ? "font-medium text-fg" : "text-fg-muted",
                  )}
                >
                  {item.label}
                </span>
              ) : renderLink ? (
                renderLink(item, index)
              ) : (
                <a
                  href={item.href}
                  className="text-fg-muted transition-colors hover:text-fg"
                >
                  {item.label}
                </a>
              )}
              {!isLast ? (
                <ChevronRight
                  className="size-3.5 text-fg-subtle rtl:rotate-180"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
