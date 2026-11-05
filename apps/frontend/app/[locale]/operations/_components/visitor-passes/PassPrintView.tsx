"use client";

import { PrintSheet } from "@vms/ui";
import * as React from "react";
import styles from "../access-cards/CardPrintView.module.css";
import { PassBack, PassFront, type PassContent } from "./PassFaces";

/** Wait for the pass images (logo, watermark, back) so they aren't printed blank. */
async function imagesReady(root: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
    ),
  );
}

/**
 * Prints the passes once when it appears: each pass as a CR80 front page then
 * its back page, so a duplex card printer pairs them. Set the driver to CR80,
 * portrait, duplex.
 */
export function PassPrintView({
  passes,
  onDone,
}: {
  passes: (PassContent & { id: string })[];
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
    <PrintSheet ref={setSheet} data-testid="pass-print">
      {passes.map((pass) => (
        <React.Fragment key={pass.id}>
          <div className={styles.page}>
            <PassFront pass={pass} />
          </div>
          <div className={styles.page}>
            <PassBack />
          </div>
        </React.Fragment>
      ))}
    </PrintSheet>
  );
}
