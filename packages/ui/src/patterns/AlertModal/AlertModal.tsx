import * as React from "react";
import { Alert, type AlertProps } from "../../components/Alert/Alert";
import {
  Dialog,
  DialogContent,
  type DialogContentProps,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../primitives/Dialog/Dialog";

export interface AlertModalProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: React.ReactNode;
  /** Prominent warning banner content (rendered inside an Alert). */
  banner: React.ReactNode;
  bannerIntent?: AlertProps["intent"];
  size?: DialogContentProps["size"];
  /** Body content (e.g. visitor info + alert summary). */
  children?: React.ReactNode;
  /** Footer actions (e.g. Close / Add Note / Escalate to SM). */
  footer?: React.ReactNode;
}

/**
 * Centered modal for security alerts (e.g. "Flagged Visitor Alert"): a title,
 * a colored warning banner, a body, and an action footer.
 */
export function AlertModal({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  banner,
  bannerIntent = "danger",
  size = "lg",
  children,
  footer,
}: AlertModalProps) {
  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Alert intent={bannerIntent}>{banner}</Alert>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
