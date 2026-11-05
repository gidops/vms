"use client";

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@vms/ui";
import { Printer, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

/**
 * Enlarged, one-side-at-a-time preview of a printable card (access card,
 * visitor pass). Front first; Flip turns it over. Printing is the caller's:
 * `onPrint` starts it and `printView` renders the print sheet while it runs.
 */
export function FlipPreviewDialog({
  open,
  onOpenChange,
  title,
  front,
  back,
  faceWidth,
  faceHeight,
  printLabel,
  onPrint,
  printing = false,
  printView,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  front: React.ReactNode;
  back: React.ReactNode;
  /** The faces' true (print) size as CSS lengths; the dialog scales them up. */
  faceWidth: string;
  faceHeight: string;
  printLabel?: string;
  /** Omit to preview without printing. */
  onPrint?: () => void;
  printing?: boolean;
  printView?: React.ReactNode;
}) {
  const t = useTranslations("operations.preview");
  const [flipped, setFlipped] = React.useState(false);

  const change = (next: boolean) => {
    // Every opening starts on the front.
    if (!next) setFlipped(false);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          {/* Scaled for screen only; physical left/origin keep it anchored the same way in RTL. */}
          <div
            className="relative [--s:1.25] sm:[--s:1.5]"
            style={{
              width: `calc(${faceWidth} * var(--s))`,
              height: `calc(${faceHeight} * var(--s))`,
            }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left [perspective:1200px]"
              style={{ transform: "scale(var(--s))" }}
            >
              <div
                data-testid="card-flipper"
                className={cn(
                  "relative transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
                  flipped && "[transform:rotateY(180deg)]",
                )}
                style={{ width: faceWidth, height: faceHeight }}
              >
                <div
                  aria-hidden={flipped || undefined}
                  className="absolute inset-0 [backface-visibility:hidden]"
                >
                  {front}
                </div>
                <div
                  aria-hidden={!flipped || undefined}
                  className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                >
                  {back}
                </div>
              </div>
            </div>
          </div>

          <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {flipped ? t("back") : t("front")}
          </span>
        </div>

        <DialogFooter>
          <Button
            type="button"
            intent="neutral"
            tone="outline"
            onClick={() => setFlipped((f) => !f)}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("flip")}
          </Button>
          {onPrint ? (
            <Button type="button" onClick={onPrint} disabled={printing}>
              <Printer className="size-4" aria-hidden="true" />
              {printLabel ?? t("print")}
            </Button>
          ) : null}
        </DialogFooter>

        {printing ? printView : null}
      </DialogContent>
    </Dialog>
  );
}
