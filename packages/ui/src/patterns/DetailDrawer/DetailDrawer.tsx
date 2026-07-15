import { ChevronDown } from "lucide-react";
import * as React from "react";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  type DrawerContentProps,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../../components/Drawer/Drawer";
import { cn } from "../../foundations/cn";

export interface DetailDrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the drawer (rendered via asChild). */
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Sticky footer action area. */
  footer?: React.ReactNode;
  side?: DrawerContentProps["side"];
  children: React.ReactNode;
}

/**
 * Right-side details panel used for "Visit Request Details" — a header, a
 * scrollable sectioned body, and a sticky action footer. Compose the body from
 * <DetailSection> blocks plus any cards / Timeline / badges.
 */
export function DetailDrawer({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  footer,
  side = "end",
  children,
}: DetailDrawerProps) {
  return (
    <Drawer open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
      <DrawerContent side={side}>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description ? (
            <DrawerDescription>{description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">{children}</DrawerBody>
        {footer ? <DrawerFooter>{footer}</DrawerFooter> : null}
      </DrawerContent>
    </Drawer>
  );
}

export interface DetailSectionProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "title"
> {
  title: React.ReactNode;
  /** When true, the section header becomes a toggle that shows/hides the body. */
  collapsible?: boolean;
  /** Initial open state for a collapsible section (default open). */
  defaultOpen?: boolean;
}

/**
 * A titled block in a DetailDrawer body. With `collapsible`, the heading becomes
 * an accessible toggle (aria-expanded + a labelled region) with a rotating
 * chevron — used by the Visit Details sheet where every section can collapse.
 */
export function DetailSection({
  title,
  collapsible = false,
  defaultOpen = true,
  className,
  children,
  ...props
}: DetailSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  // Stable, SSR-safe ids linking the toggle to its region (useId avoids hydration
  // mismatch across server/client renders).
  const reactId = React.useId();
  const bodyId = `detail-section-${reactId}`;

  if (!collapsible) {
    return (
      <section className={cn("flex flex-col gap-2", className)} {...props}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
          {title}
        </h3>
        {children}
      </section>
    );
  }

  return (
    <section className={cn("flex flex-col gap-2", className)} {...props}>
      <h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex w-full items-center justify-between gap-2 text-start text-xs font-semibold uppercase tracking-wide text-primary outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <span>{title}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-fg-subtle transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="flex flex-col gap-2">
        {children}
      </div>
    </section>
  );
}
