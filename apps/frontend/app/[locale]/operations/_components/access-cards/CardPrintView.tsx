"use client";

import { PrintSheet } from "@vms/ui";
import * as React from "react";
import { CardBack, CardFront, type CardContent } from "./CardFaces";
import styles from "./CardPrintView.module.css";

/** Wait for the card's images (logo, photo) so they aren't printed blank. */
async function imagesReady(root: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
    ),
  );
}

/** Prints the card once when it appears; set the driver to CR80, portrait, duplex. */
export function CardPrintView({
  card,
  onDone,
}: {
  card: CardContent;
  onDone: () => void;
}) {
  const [sheet, setSheet] = React.useState<HTMLDivElement | null>(null);
  const done = React.useRef(onDone);
  React.useEffect(() => {
    done.current = onDone;
  });

  React.useEffect(() => {
    if (!sheet) return;
    let cancelled = false;
    void imagesReady(sheet).then(() => {
      if (cancelled) return;
      window.print();
      done.current();
    });
    return () => {
      cancelled = true;
    };
  }, [sheet]);

  return (
    <PrintSheet ref={setSheet} data-testid="card-print">
      <div className={styles.page}>
        <CardFront card={card} />
      </div>
      <div className={styles.page}>
        <CardBack card={card} />
      </div>
    </PrintSheet>
  );
}
