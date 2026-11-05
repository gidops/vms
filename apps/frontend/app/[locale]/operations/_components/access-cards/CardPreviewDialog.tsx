"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { FlipPreviewDialog } from "../FlipPreviewDialog";
import { CardBack, CardFront, type CardContent } from "./CardFaces";
import { CardPrintView } from "./CardPrintView";

/** Access card preview; Print always sends both sides (duplex), whichever side is showing. */
export function CardPreviewDialog({
  open,
  onOpenChange,
  card,
  onPrinted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CardContent;
  /** Omit to preview without printing (e.g. a closed card). */
  onPrinted?: () => void;
}) {
  const t = useTranslations("operations.accessCards.sheet");
  const [printing, setPrinting] = React.useState(false);

  return (
    <FlipPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("previewTitle")}
      front={<CardFront card={card} />}
      back={<CardBack card={card} />}
      faceWidth="54mm"
      faceHeight="85.6mm"
      printLabel={t("print")}
      onPrint={onPrinted ? () => setPrinting(true) : undefined}
      printing={printing}
      printView={
        <CardPrintView
          card={card}
          onDone={() => {
            setPrinting(false);
            onPrinted?.();
          }}
        />
      }
    />
  );
}
