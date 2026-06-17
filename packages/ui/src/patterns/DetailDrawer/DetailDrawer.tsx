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
}

export function DetailSection({
  title,
  className,
  children,
  ...props
}: DetailSectionProps) {
  return (
    <section className={cn("flex flex-col gap-2", className)} {...props}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
        {title}
      </h3>
      {children}
    </section>
  );
}
