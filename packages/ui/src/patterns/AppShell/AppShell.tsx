import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";

export interface NavItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  href?: string;
  onClick?: () => void;
}

export interface AppShellProps {
  /** Brand/logo rendered at the top of the sidebar. */
  brand?: React.ReactNode;
  nav?: NavItem[];
  /** Leading topbar content (e.g. search + filters). */
  headerStart?: React.ReactNode;
  /** Trailing topbar content (e.g. notifications + user menu). */
  headerEnd?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function NavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const className = cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    item.active
      ? "bg-primary-subtle text-primary"
      : "text-fg-muted hover:bg-surface-muted hover:text-fg",
  );
  const content = (
    <>
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{item.label}</span>
    </>
  );
  if (item.href) {
    return (
      <a
        href={item.href}
        className={className}
        aria-current={item.active ? "page" : undefined}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={item.onClick}
      className={cn(className, "text-start")}
      aria-current={item.active ? "page" : undefined}
    >
      {content}
    </button>
  );
}

export function AppShell({
  brand,
  nav,
  headerStart,
  headerEnd,
  children,
  className,
}: AppShellProps) {
  return (
    <div className={cn("flex h-screen w-full bg-canvas text-fg", className)}>
      <aside className="hidden w-60 shrink-0 flex-col border-e border-border bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4 font-semibold">
          {brand}
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {nav?.map((item) => (
            <NavLink key={item.key} item={item} />
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {headerStart}
          </div>
          <div className="flex items-center gap-2">{headerEnd}</div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
