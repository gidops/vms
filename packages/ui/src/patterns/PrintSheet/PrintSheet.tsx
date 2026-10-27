import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../foundations/cn";

export interface PrintSheetProps {
  children: React.ReactNode;
  /** Show the sheet inline on screen instead of only in print (Storybook, previews). */
  preview?: boolean;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
  "data-testid"?: string;
}

const subscribeNoop = () => () => {};

/**
 * Content that exists only on paper. It is portalled to <body> so the print
 * stylesheet (`@vms/ui/print.css`) can hide everything else while printing.
 */
export function PrintSheet({
  children,
  preview = false,
  className,
  ref,
  ...rest
}: PrintSheetProps) {
  // Portals need document.body, which only exists on the client.
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const sheet = (
    <div
      ref={ref}
      className={cn("vms-print-sheet", className)}
      data-preview={preview || undefined}
      aria-hidden={preview ? undefined : true}
      {...rest}
    >
      {children}
    </div>
  );
  if (preview) return sheet;
  return mounted ? createPortal(sheet, document.body) : null;
}
