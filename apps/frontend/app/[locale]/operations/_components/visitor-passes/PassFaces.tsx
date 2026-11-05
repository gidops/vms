"use client";

import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import { cn } from "@vms/ui";
import { useTranslations } from "next-intl";
import type * as React from "react";

/**
 * The approved AATC visitor pass (VMS v1 design), ported 1:1. The printed text
 * stays English like the approved card; only accessible labels are translated.
 * 204 × 325 px on screen = CR80 (53.98 × 85.6 mm) on paper.
 */

export interface PassContent {
  /** Floor-wing, printed as the venue ("5th Floor - Left Wing" → two lines). */
  zone: string;
  cardNumber: string;
}

const ASSETS = "/brand/visitor-pass";
const TEAL = "#0d9488";
const BAND = "#007570";
const GRAY_800 = "#1f2937";
const GRAY_700 = "#374151";
// Tailwind's default sans stack, as the template renders everything not set in Montserrat.
const SANS = 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji"';
const MONTSERRAT = "'Montserrat', sans-serif";

/** The template's diamond tile; stroke colour varies per layer. */
const pattern = (stroke: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><rect width="60" height="60" fill="#fff"/><path d="M30 15L15 30 30 45 45 30z" stroke="${stroke}" stroke-width="1.5" fill="none"/></svg>`,
  )}")`;

/** "Floor 3 - Conference Room" prints on two lines, as in v1's setVenue(). */
export function venueLines(zone: string): string[] {
  const lines = zone.includes(" - ")
    ? zone.split(" - ").map((p) => p.trim())
    : [zone];
  return lines.filter(Boolean).length ? lines : ["N/A"];
}

const faceBase =
  "relative h-[325px] w-[204px] shrink-0 overflow-hidden print:h-[85.6mm] print:w-[53.98mm] print:rounded-none print:shadow-none [print-color-adjust:exact]";

function Face({
  label,
  className,
  style,
  children,
}: {
  label: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      dir="ltr"
      data-theme="light"
      className={cn(faceBase, className)}
      style={{ fontFamily: SANS, ...style }}
    >
      {children}
    </div>
  );
}

export function PassFront({ pass }: { pass: PassContent }) {
  const t = useTranslations("operations.visitorPasses");
  return (
    <Face
      label={t("frontLabel", { zone: pass.zone, number: pass.cardNumber })}
      className="flex bg-white shadow-xl"
      style={{
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(245, 245, 245, 0.95) 100%)",
      }}
    >
      <div
        className="absolute right-0 top-0 h-[18px] w-[18px] border-r-2 border-t-2"
        style={{ borderColor: TEAL }}
      />
      <div
        className="absolute bottom-0 right-0 h-[18px] w-[18px] border-b-2 border-r-2"
        style={{ borderColor: TEAL }}
      />

      <div
        className="relative flex w-12 items-center justify-center overflow-hidden"
        style={{ backgroundColor: BAND }}
      >
        <div
          className="font-bold tracking-wide text-white [text-orientation:mixed] [writing-mode:vertical-lr]"
          style={{ fontSize: 23 }}
        >
          VISITOR PASS
        </div>
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: pattern("#ffffff") }}
        />
      </div>

      <div className="relative flex flex-1 flex-col px-3 py-4">
        <div className="mb-3 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${ASSETS}/logo-green-yellow.png`}
            alt=""
            className="h-auto max-w-[90px]"
          />
        </div>

        <div className="z-20 flex flex-1 flex-col justify-center px-2 py-1 text-center">
          <div className="mb-3">
            <div
              className="text-[16px] font-bold"
              style={{
                color: GRAY_800,
                fontFamily: MONTSERRAT,
                lineHeight: 1.2,
              }}
            >
              Venue: <br />
              <span data-testid="pass-venue">
                {venueLines(pass.zone).map((line, i) => (
                  <span key={i}>
                    {i > 0 ? <br /> : null}
                    {line}
                  </span>
                ))}
              </span>
            </div>
          </div>
          <div className="mb-3">
            <div
              className="text-[16px] font-bold"
              style={{ color: GRAY_800, fontFamily: MONTSERRAT }}
            >
              Pass ID: {pass.cardNumber}
            </div>
          </div>

          <div
            className="mx-auto my-4 h-px w-4/5 rounded-full"
            style={{
              background: `linear-gradient(to right, transparent, ${TEAL}, transparent)`,
            }}
          />

          <div className="z-20 text-center">
            <div
              className="text-xs font-medium leading-tight"
              style={{ color: GRAY_700 }}
            >
              Must be visibly worn at all times while on premises
            </div>
          </div>
        </div>

        <div className="absolute bottom-1 right-1 z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${ASSETS}/Picture3.png`}
            alt=""
            className="h-[3.5rem] opacity-25"
          />
        </div>

        <div
          className="absolute inset-0 opacity-5"
          style={{ backgroundImage: pattern(TEAL) }}
        />
      </div>
    </Face>
  );
}

export function PassBack() {
  const t = useTranslations("operations.visitorPasses");
  // An <img> (not a CSS background) so printing waits for it to load.
  return (
    <Face
      label={t("backLabel")}
      className="rounded-[8px] shadow-[0_4px_8px_rgba(0,0,0,0.1)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${ASSETS}/back.jpg`}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    </Face>
  );
}
