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

/** Portalled to <body> so printing hides app chrome; set the driver to CR80, portrait, duplex. */
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
