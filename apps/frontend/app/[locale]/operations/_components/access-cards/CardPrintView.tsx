"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CardBack, CardFront, type CardContent } from "./CardFaces";

const subscribeNoop = () => () => {};

/** Wait for the card's images (logo, photo) so they aren't printed blank. */
async function imagesReady(root: HTMLElement | null): Promise<void> {
  if (!root) return;
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
    ),
  );
}

/**
 * Print-only copy of one access card for the DTC card printer: front and back
 * as two portrait CR80 pages (`@page rfidcard` in globals.css), portalled to
 * <body> so printing hides all app chrome. Mount it to print: it waits for the
 * images, opens the print dialog, then calls `onDone` (e.g. to log the print).
 * Set the printer driver to CR80, portrait, and duplex for the back.
 */
export function CardPrintView({
  card,
  onDone,
}: {
  card: CardContent;
  onDone: () => void;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  React.useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    void imagesReady(root.current).then(() => {
      if (cancelled) return;
      window.print();
      onDone();
    });
    return () => {
      cancelled = true;
    };
    // Print once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <div ref={root} className="rfidcard-print-root" data-testid="card-print">
      <div className="rfidcard-page">
        <CardFront card={card} />
      </div>
      <div className="rfidcard-page">
        <CardBack card={card} />
      </div>
    </div>,
    document.body,
  );
}
