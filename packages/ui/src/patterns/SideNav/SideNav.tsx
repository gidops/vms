import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import { sideNavVariants } from "./SideNav.variants";

export interface SideNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  active?: boolean;
  /** Give `disabledHint` too, so the reason is announced and shown on hover. */
  disabled?: boolean;
  disabledHint?: string;
}

export interface SideNavLinkProps {
  href: string;
  className?: string;
  "aria-current"?: "page";
  "aria-label"?: string;
  children: React.ReactNode;
}

export interface SideNavProps {
  items: SideNavItem[];
  label: string;
  linkAs?: React.ElementType<SideNavLinkProps>;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Omit both labels to hide the collapse toggle. */
  collapseLabel?: string;
  expandLabel?: string;
  className?: string;
}

/** Vertical section nav for console pages; the rail can collapse to icons only. */
export function SideNav({
  items,
  label,
  linkAs: LinkAs = "a",
  collapsed = false,
  onCollapsedChange,
  collapseLabel,
  expandLabel,
  className,
}: SideNavProps) {
  const s = sideNavVariants({ collapsed });
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const showToggle = onCollapsedChange && collapseLabel && expandLabel;

  return (
    <nav aria-label={label} className={cn(s.root(), className)}>
      <ul className={s.list()}>
        {items.map((item) => {
          const Icon = item.icon;
          const itemClass = sideNavVariants({
            collapsed,
            active: item.active,
            disabled: item.disabled,
          }).item();
          const content = (
            <>
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {collapsed ? null : (
                <span className="truncate">{item.label}</span>
              )}
            </>
          );
          return (
            <li key={item.key}>
              {item.href && !item.disabled ? (
                <LinkAs
                  href={item.href}
                  className={itemClass}
                  aria-current={item.active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                >
                  {content}
                </LinkAs>
              ) : (
                <span
                  role="link"
                  aria-disabled="true"
                  aria-label={
                    item.disabledHint
                      ? `${item.label} (${item.disabledHint})`
                      : item.label
                  }
                  title={item.disabledHint}
                  className={itemClass}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {showToggle ? (
        <div className={s.footer()}>
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? expandLabel : collapseLabel}
            aria-expanded={!collapsed}
            className={s.toggle()}
          >
            <ToggleIcon
              className="size-5 rtl:-scale-x-100"
              aria-hidden="true"
            />
          </button>
        </div>
      ) : null}
    </nav>
  );
}
