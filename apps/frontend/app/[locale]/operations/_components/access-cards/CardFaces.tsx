"use client";

import { cn } from "@vms/ui";
import { UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type * as React from "react";
import { formatWatDateTime } from "@/shared/wat";

/** What is printed on an RFID access card. */
export interface CardContent {
  fullName: string;
  organization: string | null;
  cardNumber: string;
  validFrom: string;
  validUntil: string;
  /** Signed photo URL, or null to print an empty photo frame. */
  photoUrl: string | null;
}

/** Sized in mm so the same markup is the preview and the printed CR80 card; always light theme, since print doesn't follow dark mode. */
function Face({
  className,
  children,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      data-theme="light"
      className={cn(
        "rfidcard-face relative flex h-[85.6mm] w-[54mm] shrink-0 flex-col overflow-hidden rounded-[3mm] border border-border bg-surface text-fg",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Validity({ card }: { card: CardContent }) {
  const t = useTranslations("operations.card");
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-[0.6mm] text-[6.5pt] leading-tight">
      <span className="font-semibold uppercase tracking-wide text-fg-muted">
        {t("valid")}
      </span>
      <span>
        {formatWatDateTime(card.validFrom, locale)} –{" "}
        {formatWatDateTime(card.validUntil, locale)}
      </span>
    </div>
  );
}

export function CardFront({ card }: { card: CardContent }) {
  const t = useTranslations("operations.card");
  return (
    <Face label={t("frontLabel", { name: card.fullName })}>
      <div className="flex justify-center px-[3mm] pt-[3mm]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/afreximbank-aatc-lockup.png"
          alt=""
          className="h-[9mm] w-auto object-contain"
        />
      </div>
      <div className="mt-[2mm] bg-emphasis py-[1.2mm] text-center text-[8pt] font-bold tracking-[0.18em] text-emphasis-fg [print-color-adjust:exact]">
        {t("visitorAccess")}
      </div>
      <div className="flex justify-center pt-[3mm]">
        {card.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.photoUrl}
            alt=""
            className="h-[30mm] w-[24mm] rounded-[1mm] object-cover"
          />
        ) : (
          <div className="flex h-[30mm] w-[24mm] items-center justify-center rounded-[1mm] border border-dashed border-border text-fg-subtle">
            <UserRound className="size-[10mm]" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center gap-[0.8mm] px-[3mm] pt-[2.5mm] text-center">
        <span className="line-clamp-2 text-[10pt] font-bold leading-tight">
          {card.fullName}
        </span>
        {card.organization ? (
          <span className="line-clamp-1 text-[7pt] text-fg-muted">
            {card.organization}
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-[2mm] px-[3mm] pb-[3mm]">
        <Validity card={card} />
        <span className="font-mono text-[7pt] font-semibold">
          {card.cardNumber}
        </span>
      </div>
    </Face>
  );
}

export function CardBack({ card }: { card: CardContent }) {
  const t = useTranslations("operations.card");
  return (
    <Face label={t("backLabel")} className="px-[4mm] py-[5mm]">
      <span className="text-center text-[8pt] font-bold tracking-[0.12em]">
        {t("backTitle")}
      </span>
      <div className="mt-[4mm] flex flex-col gap-[3mm] text-[7pt] leading-snug">
        <div className="flex flex-col gap-[0.6mm]">
          <span className="font-semibold uppercase tracking-wide text-fg-muted">
            {t("cardNumber")}
          </span>
          <span className="font-mono text-[9pt] font-semibold">
            {card.cardNumber}
          </span>
        </div>
        <Validity card={card} />
        <p>{t("returnNotice")}</p>
        <p>{t("foundNotice")}</p>
      </div>
      <span className="mt-auto text-center text-[6pt] text-fg-muted">
        {t("property")}
      </span>
    </Face>
  );
}
